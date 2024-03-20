use std::{path::PathBuf, time::Duration};

use clap::Parser;
use figment::providers::Format;
use ott_common::discovery::DiscoveryConfig;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct CollectorConfig {
    #[serde(default)]
    pub discovery: DiscoveryConfig,
    #[serde(default)]
    #[serde(with = "humantime_serde")]
    pub collect_interval: Duration,
    pub balancer_api_key: String,
}

impl Default for CollectorConfig {
    fn default() -> Self {
        CollectorConfig {
            discovery: Default::default(),
            collect_interval: Duration::from_secs(5),
            balancer_api_key: "".to_owned(),
        }
    }
}

impl CollectorConfig {
    pub fn load(path: &PathBuf) -> Result<Self, anyhow::Error> {
        let config: CollectorConfig = figment::Figment::new()
            .merge(figment::providers::Toml::file(path))
            .extract()?;
        Ok(config)
    }
}

#[derive(Debug, Parser)]
pub struct Cli {
    #[clap(short, long, default_value = "collector.toml")]
    pub config_path: PathBuf,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_collect_interval_1() {
        let json = serde_json::json!({
            "collect_interval": "10s",
            "balancer_api_key": "test"
        });
        let conf = serde_json::from_value::<CollectorConfig>(json).expect("failed to parse json");
        assert_eq!(conf.collect_interval, Duration::from_secs(10));
    }
}
