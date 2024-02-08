use async_trait::async_trait;
use tracing::info;
use trust_dns_resolver::TokioAsyncResolver;

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct DnsDiscoveryConfig {
    /// The port that monoliths should be listening on for load balancer connections.
    pub monolith_port: u16,
    pub dns_server: Option<String>,
    pub query: String
}

pub struct DnsMonolithDiscoverer {
    config: DnsDiscoveryConfig,
}

impl DnsMonolithDiscoverer {
    pub fn new(config: DnsDiscoveryConfig) -> Self {
        info!(
            "Creating DockerMonolithDiscoverer, Docker DNS server: {}",
            dns_server
        );
        let query = format!("{}", &config.dns_server);
        Self { config }
    }
}

#[async_trait]
impl MonolithDiscoverer for DnsMonolithDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        let resolver =
            TokioAsyncResolver::tokio_from_system_conf().expect("failed to create resolver");

        let lookup = resolver.ipv4_lookup(&self).await?;
        let monoliths = lookup
            .iter()
            .map(|ip| MonolithConnectionConfig {
                host: HostOrIp::Ip(IpAddr::V4(*ip)),
                port: self.config.monolith_port,
            })
            .collect::<Vec<_>>();

        Ok(monoliths)
    }

    fn mode(&self) -> DiscoveryMode {
        DiscoveryMode::Polling(Duration::from_secs(10))
    }
}
