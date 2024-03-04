use async_trait::async_trait;
use tracing::info;
use trust_dns_resolver::{
    config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts},
    TokioAsyncResolver,
};

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct DnsDiscoveryConfig {
    /// The port that monoliths should be listening on for load balancer connections.
    pub service_port: u16,
    /// The DNS server to query. Optional. If not provided, the system configuration will be used instead.
    pub dns_server: Option<SocketAddr>,
    /// The A record to query. If using docker-compose, this should be the service name for the monolith.
    pub query: String,
}

pub struct DnsServiceDiscoverer {
    config: DnsDiscoveryConfig,
}

impl DnsServiceDiscoverer {
    pub fn new(config: DnsDiscoveryConfig) -> Self {
        info!(
            "Creating DnsServiceDiscoverer, DNS server: {:?}",
            config.dns_server
        );
        Self { config }
    }
}

#[async_trait]
impl ServiceDiscoverer for DnsServiceDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<ConnectionConfig>> {
        let resolver = match self.config.dns_server {
            None => {
                TokioAsyncResolver::tokio_from_system_conf().expect("failed to create resolver")
            }
            Some(server) => {
                let mut resolver_config = ResolverConfig::new();
                resolver_config.add_name_server(NameServerConfig::new(server, Protocol::Udp));

                TokioAsyncResolver::tokio(resolver_config, ResolverOpts::default())
                    .expect("failed to create resolver")
            }
        };

        let lookup = resolver.ipv4_lookup(&self.config.query).await?;
        let monoliths = lookup
            .iter()
            .map(|ip| ConnectionConfig {
                host: HostOrIp::Ip(IpAddr::V4(*ip)),
                port: self.config.service_port,
            })
            .collect::<Vec<_>>();

        Ok(monoliths)
    }

    fn mode(&self) -> DiscoveryMode {
        DiscoveryMode::Polling(Duration::from_secs(10))
    }
}

mod test {
    use super::*;

    #[tokio::test]
    async fn server_deserializes_correctly() {
        let json = json!({
            "service_port": 8080,
            "dns_server": "127.0.0.1:8080",
            "query": "".to_string(),
        });

        let config: DnsDiscoveryConfig =
            serde_json::from_value(json).expect("Failed to deserialize json");

        assert_eq!(config.query, "".to_string())
    }
}
