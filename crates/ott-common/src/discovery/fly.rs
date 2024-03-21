use async_trait::async_trait;
use serde::Deserialize;
use hickory_resolver::TokioAsyncResolver;
use tracing::info;

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct FlyDiscoveryConfig {
    /// The port that monoliths should be listening on for load balancer connections.
    pub service_port: u16,
    pub fly_app: String,
    /// The polling mode discovery interval.
    #[serde(with = "humantime_serde")]
    pub polling_interval: Option<Duration>,
}

pub struct FlyServiceDiscoverer {
    config: FlyDiscoveryConfig,
    query: String,
}

impl FlyServiceDiscoverer {
    pub fn new(config: FlyDiscoveryConfig) -> Self {
        info!(
            "Creating FlyServiceDiscoverer, fly app: {}",
            &config.fly_app
        );
        let query = format!("global.{}.internal", &config.fly_app);
        Self { config, query }
    }
}

#[async_trait]
impl ServiceDiscoverer for FlyServiceDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<ConnectionConfig>> {
        let resolver =
            TokioAsyncResolver::tokio_from_system_conf().expect("failed to create resolver");

        let lookup = resolver.ipv6_lookup(&self.query).await?;
        let instances = lookup
            .iter()
            .map(|ip| ConnectionConfig {
                host: HostOrIp::Ip(ip.0.into()),
                port: self.config.service_port,
            })
            .collect::<Vec<_>>();

        Ok(instances)
    }

    fn mode(&self) -> DiscoveryMode {
        DiscoveryMode::Polling(
            self.config
                .polling_interval
                .unwrap_or_else(|| Duration::from_secs(10)),
        )
    }
}
