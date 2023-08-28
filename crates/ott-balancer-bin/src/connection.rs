//! Manages connections to Monoliths.

use std::collections::HashSet;

use crate::balancer::BalancerLink;
use crate::discovery::{MonolithConnectionConfig, MonolithDiscoveryMsg};

pub struct MonolithConnectionManager {
    discovery_rx: tokio::sync::mpsc::Receiver<MonolithDiscoveryMsg>,
    link: BalancerLink,

    monoliths: HashSet<MonolithConnectionConfig>,
}

impl MonolithConnectionManager {
    pub fn new(
        discovery_rx: tokio::sync::mpsc::Receiver<MonolithDiscoveryMsg>,
        link: BalancerLink,
    ) -> Self {
        Self {
            discovery_rx,
            monoliths: Default::default(),
            link,
        }
    }

    pub async fn do_connection_job(&mut self) -> anyhow::Result<()> {
        let msg = self
            .discovery_rx
            .recv()
            .await
            .ok_or_else(|| anyhow::anyhow!("Discovery channel closed"))?;
        self.monoliths.extend(msg.added);
        self.monoliths.retain(|m| !msg.removed.contains(m));

        // TODO: actually start connections and manage them

        Ok(())
    }
}
