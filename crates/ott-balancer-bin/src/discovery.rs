//! Handles discovery of Monoliths.

use std::collections::HashSet;
use std::net::IpAddr;
use std::time::Duration;

mod fly;
mod manual;

pub use fly::*;
pub use manual::*;

use async_trait::async_trait;
use serde::Deserialize;
use tokio::task::JoinHandle;
use tracing::{error, warn};

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Deserialize)]
pub struct MonolithConnectionConfig {
    pub host: HostOrIp,
    pub port: u16,
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
pub trait MonolithDiscovery {
    async fn discover(&self) -> anyhow::Result<Vec<MonolithConnectionConfig>>;
}

pub struct DiscoveryTask {
    discovery: Box<dyn MonolithDiscovery + Send + Sync>,

    monoliths: HashSet<MonolithConnectionConfig>,
    discovery_tx: tokio::sync::mpsc::Sender<MonolithDiscoveryMsg>,
}

impl DiscoveryTask {
    pub fn new(
        discovery: impl MonolithDiscovery + Send + Sync + 'static,
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
            }

            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    }

    async fn do_discovery(&mut self) -> anyhow::Result<()> {
        let monoliths = self.discovery.discover().await?;
        let monoliths_new: HashSet<_> = monoliths.into_iter().collect();
        let monoliths_added = monoliths_new
            .difference(&self.monoliths)
            .cloned()
            .collect::<Vec<_>>();
        let monoliths_removed = self
            .monoliths
            .difference(&monoliths_new)
            .cloned()
            .collect::<Vec<_>>();
        let msg = MonolithDiscoveryMsg {
            added: monoliths_added,
            removed: monoliths_removed,
        };
        self.discovery_tx.send(msg).await?;

        if self.monoliths.is_empty() {
            warn!("No monoliths discovered");
        }

        Ok(())
    }

    pub fn discovered_monoliths(&self) -> &HashSet<MonolithConnectionConfig> {
        &self.monoliths
    }
}

pub fn start_discovery_task(
    discovery: impl MonolithDiscovery + Send + Sync + 'static,
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
