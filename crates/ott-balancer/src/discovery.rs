//! Handles discovery of Monoliths.

use std::net::IpAddr;
use std::time::Duration;
use std::{collections::HashSet, net::SocketAddr};

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
use tracing::{debug, error, warn};
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

pub struct DiscoveryTask {
    discovery: Box<dyn MonolithDiscoverer + Send + Sync>,

    monoliths: HashSet<MonolithConnectionConfig>,
    discovery_tx: tokio::sync::mpsc::Sender<MonolithDiscoveryMsg>,
}

impl DiscoveryTask {
    pub fn new(
        discovery: impl MonolithDiscoverer + Send + Sync + 'static,
        discovery_tx: tokio::sync::mpsc::Sender<MonolithDiscoveryMsg>,
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
    current: &HashSet<MonolithConnectionConfig>,
    new: &HashSet<MonolithConnectionConfig>,
) -> MonolithDiscoveryMsg {
    let monoliths_added = new.difference(current).cloned().collect::<Vec<_>>();
    let monoliths_removed = current.difference(new).cloned().collect::<Vec<_>>();
    MonolithDiscoveryMsg {
        added: monoliths_added,
        removed: monoliths_removed,
    }
}

pub fn start_discovery_task(
    discovery: impl MonolithDiscoverer + Send + Sync + 'static,
    discovery_tx: tokio::sync::mpsc::Sender<MonolithDiscoveryMsg>,
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
pub struct MonolithDiscoveryMsg {
    pub added: Vec<MonolithConnectionConfig>,
    pub removed: Vec<MonolithConnectionConfig>,
}
