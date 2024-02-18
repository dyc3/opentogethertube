//! Handles discovery of Monoliths.

use std::net::IpAddr;
use std::net::SocketAddr;
use std::time::Duration;

mod dns;
mod fly;
mod harness;
mod manual;

pub use dns::*;
pub use fly::*;
pub use harness::*;
pub use manual::*;

use async_trait::async_trait;
use serde::Deserialize;
use tokio::task::JoinHandle;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Deserialize)]
pub struct MonolithConnectionConfig {
    pub host: HostOrIp,
    pub port: u16,
}

impl MonolithConnectionConfig {
    pub fn uri(&self) -> Url {
        let mut url = Url::parse("ws://localhost").unwrap();
        match self.host {
            HostOrIp::Host(ref host) => {
                url.set_host(Some(host)).unwrap();
            }
            HostOrIp::Ip(ip) => {
                url.set_ip_host(ip).unwrap();
            }
        }
        url.set_port(Some(self.port)).unwrap();

        url
    }
}

impl From<SocketAddr> for MonolithConnectionConfig {
    fn from(addr: SocketAddr) -> Self {
        Self {
            host: HostOrIp::Ip(addr.ip()),
            port: addr.port(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum HostOrIp {
    Host(String),
    Ip(IpAddr),
}

impl<'de> Deserialize<'de> for HostOrIp {
    fn deserialize<D>(deserializer: D) -> Result<HostOrIp, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        if let Ok(ip) = s.parse::<IpAddr>() {
            Ok(HostOrIp::Ip(ip))
        } else {
            Ok(HostOrIp::Host(s))
        }
    }
}

#[async_trait]
pub trait MonolithDiscoverer {
    /// In polling mode, this function should immediately return the current list of monoliths. In continuous mode, this function should wait until the list of monoliths changes, then return the new list.
    async fn discover(&mut self) -> anyhow::Result<Vec<MonolithConnectionConfig>>;
    fn mode(&self) -> DiscoveryMode;
}

pub enum DiscoveryMode {
    Polling(Duration),
    Continuous,
}
