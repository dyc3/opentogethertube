use std::{borrow::BorrowMut, path::PathBuf, sync::Once};

use clap::{Parser, ValueEnum};
use figment::providers::Format;
use ott_balancer_protocol::Region;
use serde::Deserialize;

use ott_common::discovery::DiscoveryConfig;

use crate::selection::MonolithSelectionConfig;

static mut CONFIG: Option<BalancerConfig> = None;

static CONFIG_INIT: Once = Once::new();

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct BalancerConfig {
    /// The port to listen on for HTTP requests.
    pub port: u16,
    pub discovery: DiscoveryConfig,
    pub region: Region,
    /// The API key that clients can use to access restricted endpoints.
    pub api_key: Option<String>,
    pub selection_strategy: Option<MonolithSelectionConfig>,
}

impl Default for BalancerConfig {
    fn default() -> Self {
        Self {
            port: 8081,
            discovery: DiscoveryConfig::default(),
            region: Default::default(),
            api_key: None,
            selection_strategy: None,
        }
    }
}

impl BalancerConfig {
    pub fn load(path: &PathBuf) -> Result<(), anyhow::Error> {
        let mut config: BalancerConfig = figment::Figment::new()
            .merge(figment::providers::Toml::file(path))
            .merge(figment::providers::Env::prefixed("BALANCER_"))
            .extract()?;

        if let Some(region) = figment::providers::Env::var("FLY_REGION") {
            config.region = region.into();
        }
        // SAFETY: CONFIG is only mutated once, and only from this thread. All other accesses are read-only.
        #[allow(static_mut_refs)]
        CONFIG_INIT.call_once(|| unsafe { *CONFIG.borrow_mut() = Some(config) });
        Ok(())
    }

    /// Initialize the config with default values.
    pub fn init_default() {
        // SAFETY: CONFIG is only mutated once, and only from this thread. All other accesses are read-only.
        #[allow(static_mut_refs)]
        CONFIG_INIT.call_once(|| unsafe { *CONFIG.borrow_mut() = Some(BalancerConfig::default()) });
    }

    pub fn get() -> &'static Self {
        debug_assert!(CONFIG_INIT.is_completed(), "config not initialized");
        // SAFETY: get is never called before CONFIG is initialized.
        #[allow(static_mut_refs)]
        unsafe {
            CONFIG.as_ref().expect("config not initialized")
        }
    }

    /// Get a mutable reference to the config. Should only be used for tests and benchmarks.
    ///
    /// # Safety
    ///
    /// This function makes absolutely no attempts to ensure atomicity of access to the config.
    pub unsafe fn get_mut() -> &'static mut Self {
        debug_assert!(CONFIG_INIT.is_completed(), "config not initialized");
        // SAFETY: get_mut is only used for benchmarks
        #[allow(static_mut_refs)]
        CONFIG.as_mut().expect("config not initialized")
    }
}

#[derive(Debug, Parser)]
pub struct Cli {
    #[clap(short, long, default_value = "balancer.toml")]
    pub config_path: PathBuf,

    #[clap(short, long, default_value_t = LogLevel::Info, value_enum)]
    pub log_level: LogLevel,

    /// Enable the console-subscriber for debugging via tokio-console.
    #[clap(long)]
    pub console: bool,

    /// Allow remote connections via tokio-console for debugging. By default, only local connections are allowed.
    ///
    /// The default port for tokio-console is 6669.
    #[clap(long, requires("console"))]
    pub remote_console: bool,

    /// Validate the configuration file.
    #[clap(long, short)]
    pub validate: bool,
}

impl Cli {
    pub fn build_tracing_filter(&self) -> String {
        self.log_level.into()
    }
}

#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[clap(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl Default for LogLevel {
    fn default() -> Self {
        Self::Info
    }
}

impl From<LogLevel> for String {
    fn from(val: LogLevel) -> Self {
        match val {
            LogLevel::Trace => "trace",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
        .into()
    }
}

impl From<LogLevel> for tracing::Level {
    fn from(val: LogLevel) -> Self {
        match val {
            LogLevel::Trace => Self::TRACE,
            LogLevel::Debug => Self::DEBUG,
            LogLevel::Info => Self::INFO,
            LogLevel::Warn => Self::WARN,
            LogLevel::Error => Self::ERROR,
        }
    }
}
