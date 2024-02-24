use std::{collections::HashSet, time::Duration};

pub use ott_common::discovery::*;
use tokio::task::JoinHandle;
use tracing::{debug, error, warn};

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
