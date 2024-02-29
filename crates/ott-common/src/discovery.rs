//! Handles discovery of Services.

use std::collections::HashSet;
use std::net::IpAddr;
use std::net::SocketAddr;
use std::time::Duration;
use tracing::{debug, error, warn};

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
pub struct ConnectionConfig {
    pub host: HostOrIp,
    pub port: u16,
}

impl ConnectionConfig {
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

impl From<SocketAddr> for ConnectionConfig {
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
pub trait ServiceDiscoverer {
    /// In polling mode, this function should immediately return the current list of instances. In continuous mode, this function should wait until the list of instances changes, then return the new list.
    async fn discover(&mut self) -> anyhow::Result<Vec<ConnectionConfig>>;
    fn mode(&self) -> DiscoveryMode;
}

pub enum DiscoveryMode {
    Polling(Duration),
    Continuous,
}
pub struct DiscoveryTask {
    discovery: Box<dyn ServiceDiscoverer + Send + Sync>,

    monoliths: HashSet<ConnectionConfig>,
    discovery_tx: tokio::sync::mpsc::Sender<ServiceDiscoveryMsg>,
}

impl DiscoveryTask {
    pub fn new(
        discovery: impl ServiceDiscoverer + Send + Sync + 'static,
        discovery_tx: tokio::sync::mpsc::Sender<ServiceDiscoveryMsg>,
    ) -> Self {
        Self {
            discovery: Box::new(discovery),
            monoliths: Default::default(),
            discovery_tx,
        }
    }

    pub async fn do_continuous_discovery(&mut self) {
        loop {
            if let Err(e) = self.do_discovery().await {
                error!("Monolith Discovery failed: {:?}", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }

    async fn do_discovery(&mut self) -> anyhow::Result<()> {
        let monoliths = self.discovery.discover().await?;
        debug!("Discovered monoliths: {:?}", monoliths);
        let monoliths_new: HashSet<_> = monoliths.into_iter().collect();
        let msg = build_discovery_msg(&self.monoliths, &monoliths_new);
        // apply the changes to our state
        for m in &msg.removed {
            self.monoliths.remove(m);
        }
        self.monoliths.extend(monoliths_new);
        // send the message
        self.discovery_tx.send(msg).await?;

        if self.monoliths.is_empty() {
            warn!("No monoliths discovered");
        }

        if let DiscoveryMode::Polling(d) = self.discovery.mode() {
            tokio::time::sleep(d).await;
        }

        Ok(())
    }
}

fn build_discovery_msg(
    current: &HashSet<ConnectionConfig>,
    new: &HashSet<ConnectionConfig>,
) -> ServiceDiscoveryMsg {
    let instances_added = new.difference(current).cloned().collect::<Vec<_>>();
    let instances_removed = current.difference(new).cloned().collect::<Vec<_>>();
    ServiceDiscoveryMsg {
        added: instances_added,
        removed: instances_removed,
    }
}

pub fn start_discovery_task(
    discovery: impl ServiceDiscoverer + Send + Sync + 'static,
    discovery_tx: tokio::sync::mpsc::Sender<ServiceDiscoveryMsg>,
) -> JoinHandle<()> {
    tokio::task::Builder::new()
        .name("discovery")
        .spawn(async move {
            let mut task = DiscoveryTask::new(discovery, discovery_tx);
            task.do_continuous_discovery().await;
        })
        .expect("failed to spawn discovery task")
}

#[derive(Debug, Clone)]
pub struct ServiceDiscoveryMsg {
    pub added: Vec<ConnectionConfig>,
    pub removed: Vec<ConnectionConfig>,
}
