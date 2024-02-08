use async_trait::async_trait;
use tracing::info;
use trust_dns_resolver::TokioAsyncResolver;

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct DockerDiscoveryConfig {
    /// The port that monoliths should be listening on for load balancer connections.
    pub monolith_port: u16,
    pub dns_server: Option<String>,
}

pub struct DockerMonolithDiscoverer {
    config: DockerDiscoveryConfig,
    query: Option<String>,
}

impl DockerMonolithDiscoverer {
    pub fn new(config: DockerDiscoveryConfig) -> Self {
        info!(
            "Creating DockerMonolithDiscoverer, Docker DNS server: {}",
            &config.docker_dns_server
        );
        let query = format!("{}", &config.dns_server);
        Self { config, query }
    }
}

#[async_trait]
impl MonolithDiscoverer for DockerMonolithDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        let resolver =
            TokioAsyncResolver::tokio_from_system_conf().expect("failed to create resolver");

        let lookup = resolver.ipv4_lookup(&self.query).await?;
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
