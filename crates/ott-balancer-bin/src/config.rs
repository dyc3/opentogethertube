use std::{borrow::BorrowMut, path::PathBuf, sync::Once};

use clap::Parser;
use figment::providers::Format;
use serde::Deserialize;

static mut CONFIG: Option<BalancerConfig> = None;

static CONFIG_INIT: Once = Once::new();

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct BalancerConfig {
    /// The port to listen on for HTTP requests.
    pub port: u16,
    /// The port to use when connecting to the monolith to proxy requests.
    pub monolith_port: u16,
}

impl Default for BalancerConfig {
    fn default() -> Self {
        Self {
            port: 8081,
            monolith_port: 3000,
        }
    }
}

impl BalancerConfig {
    pub fn load(path: PathBuf) -> anyhow::Result<()> {
        let config = figment::Figment::new()
            .merge(figment::providers::Toml::file(path))
            .merge(figment::providers::Env::prefixed("BALANCER_"))
            .extract()?;
        // SAFETY: CONFIG is only mutated once, and only from this thread. All other accesses are read-only.
        CONFIG_INIT.call_once(|| unsafe { *CONFIG.borrow_mut() = Some(config) });
        Ok(())
    }

    pub fn get() -> &'static Self {
        // SAFETY: get is never called before CONFIG is initialized.
        unsafe { CONFIG.as_ref().expect("config not initialized") }
    }
}

#[derive(Debug, Parser)]
pub struct Cli {
    #[clap(short, long, default_value = "balancer.toml")]
    pub config_path: PathBuf,
}
