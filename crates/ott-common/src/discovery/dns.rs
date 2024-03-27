use std::str::FromStr;

use async_trait::async_trait;
use hickory_resolver::{
    config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts},
    TokioAsyncResolver,
};
use serde::Deserializer;
use tracing::info;

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct DnsDiscoveryConfig {
    /// The port that monoliths should be listening on for load balancer connections.
    pub service_port: u16,
    /// The DNS server to query. Optional. If not provided, the system configuration will be used instead.
    #[serde(deserialize_with = "deserialize_dns_server")]
    pub dns_server: Option<SocketAddr>,
    /// The A record to query. If using docker-compose, this should be the service name for the monolith.
    pub query: String,
    /// The polling mode discovery interval.
    #[serde(default)]
    #[serde(with = "humantime_serde")]
    pub polling_interval: Option<Duration>,
}

fn deserialize_dns_server<'de, D>(deserializer: D) -> Result<Option<SocketAddr>, D::Error>
where
    D: Deserializer<'de>,
{
    let mut buf = String::deserialize(deserializer)?;

    if Option::is_none(&buf.find(':')) {
        buf.push_str(":53");
    }

    Ok(Some(
        SocketAddr::from_str(&buf).expect("Error: Could not unwrap"),
    ))
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
            }
        };

        let lookup = resolver.ipv4_lookup(&self.config.query).await?;
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
#[cfg(test)]
mod test {
    use super::*;
    use serde_json::json;

    #[test]
    fn server_deserializes_correctly() {
        let json = json!({
            "service_port": 8080,
            "dns_server": "127.0.0.1",
            "query": "".to_string(),
        });

        let config: DnsDiscoveryConfig =
            serde_json::from_value(json).expect("Failed to deserialize json");

        assert_eq!(config.dns_server, Some(([127, 0, 0, 1], 53).into()));
    }
}
