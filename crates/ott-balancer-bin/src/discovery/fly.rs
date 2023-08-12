use async_trait::async_trait;
use tracing::info;
use trust_dns_resolver::{config::*, TokioAsyncResolver};

use crate::config::BalancerConfig;

use super::*;

pub struct FlyMonolithDiscoverer {
    query: String,
}

impl FlyMonolithDiscoverer {
    pub fn new() -> Self {
        let config = BalancerConfig::get();
        info!(
            "Creating FlyMonolithDiscoverer, fly app: {}",
            config.discovery.fly_app
        );
        Self {
            query: format!("global.{}.internal", config.discovery.fly_app),
        }
    }
}

#[async_trait]
impl MonolithDiscovery for FlyMonolithDiscoverer {
    async fn discover(&self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        let resolver =
            TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default())
                .expect("failed to create resolver");
        let config = BalancerConfig::get();

        let lookup = resolver.ipv6_lookup(&self.query).await?;
        let monoliths = lookup
            .iter()
            .map(|ip| MonolithConnectionConfig {
                host: HostOrIp::Ip(IpAddr::V6(*ip)),
                port: config.discovery.port,
            })
            .collect::<Vec<_>>();

        Ok(monoliths)
    }
}
