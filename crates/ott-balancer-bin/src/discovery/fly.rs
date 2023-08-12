use async_trait::async_trait;
use tracing::info;
use trust_dns_resolver::{config::*, TokioAsyncResolver};

use crate::config::BalancerConfig;

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct FlyDiscoveryConfig {
    /// The port that monoliths should be listening on for load balancer connections.
    pub port: u16,
    pub fly_app: String,
}

pub struct FlyMonolithDiscoverer {
    config: FlyDiscoveryConfig,
    query: String,
}

impl FlyMonolithDiscoverer {
    pub fn new(config: FlyDiscoveryConfig) -> Self {
        info!(
            "Creating FlyMonolithDiscoverer, fly app: {}",
            &config.fly_app
        );
        let query = format!("global.{}.internal", &config.fly_app);
        Self { config, query }
    }
}

#[async_trait]
impl MonolithDiscovery for FlyMonolithDiscoverer {
    async fn discover(&self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        let resolver =
            TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default())
                .expect("failed to create resolver");

        let lookup = resolver.ipv6_lookup(&self.query).await?;
        let monoliths = lookup
            .iter()
            .map(|ip| MonolithConnectionConfig {
                host: HostOrIp::Ip(IpAddr::V6(*ip)),
                port: self.config.port,
            })
            .collect::<Vec<_>>();

        Ok(monoliths)
    }
}
