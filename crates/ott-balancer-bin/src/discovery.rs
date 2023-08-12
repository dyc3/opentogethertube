//! Handles discovery of Monoliths.

mod fly;

use std::{collections::HashSet, net::IpAddr, time::Duration};

use async_trait::async_trait;
pub use fly::*;
use tokio::task::JoinHandle;
use tracing::error;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct MonolithConnectionConfig {
    pub host: HostOrIp,
    pub port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum HostOrIp {
    Host(String),
    Ip(IpAddr),
}

#[async_trait]
pub trait MonolithDiscovery {
    async fn discover(&self) -> anyhow::Result<Vec<MonolithConnectionConfig>>;
}

pub struct DiscoveryTask<D> {
    discovery: D,

    monoliths: HashSet<MonolithConnectionConfig>,
}

impl<D> DiscoveryTask<D>
where
    D: MonolithDiscovery,
{
    pub fn new(discovery: D) -> Self {
        Self {
            discovery,
            monoliths: Default::default(),
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
        self.monoliths = monoliths.into_iter().collect();
        Ok(())
    }

    pub fn discovered_monoliths(&self) -> &HashSet<MonolithConnectionConfig> {
        &self.monoliths
    }
}

pub fn start_discovery_task<D>(discovery: D) -> JoinHandle<()>
where
    D: MonolithDiscovery + Send + Sync + 'static,
{
    tokio::task::Builder::new()
        .name("discovery")
        .spawn(async move {
            let mut task = DiscoveryTask::new(discovery);
            task.do_continuous_discovery().await;
        })
        .expect("failed to spawn discovery task")
}
