use std::sync::Arc;

use once_cell::sync::Lazy;
use ott_balancer_protocol::collector::BalancerState;
use ott_common::discovery::{ConnectionConfig, ServiceDiscoveryMsg};
use tokio::sync::Mutex;
use tracing::{error, warn};

use crate::SystemState;

pub static CURRENT_STATE: Lazy<Arc<Mutex<SystemState>>> =
    Lazy::new(|| Arc::new(Mutex::new(SystemState(vec![]))));

pub struct Collector {
    discovery_rx: tokio::sync::mpsc::Receiver<ServiceDiscoveryMsg>,
    interval: tokio::time::Duration,
    balancers: Vec<ConnectionConfig>,
}

impl Collector {
    pub fn new(
        discovery_rx: tokio::sync::mpsc::Receiver<ServiceDiscoveryMsg>,
        interval: tokio::time::Duration,
    ) -> Self {
        Self {
            discovery_rx,
            interval,
            balancers: Default::default(),
        }
    }

    #[must_use]
    pub fn spawn(mut self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run().await;
            warn!("Collector task ended");
        })
    }

    pub async fn run(&mut self) {
        loop {
            tokio::select! {
                _ = tokio::time::sleep(self.interval) => {
                    let new_state = match self.collect().await {
                        Ok(new_state) => new_state,
                        Err(err) => {
                            error!("Unexpected error collecting system state: {}", err);
                            continue;
                        }
                    };
                    let mut current = CURRENT_STATE.lock().await;
                    *current = new_state;
                }
                Some(msg) = self.discovery_rx.recv() => {
                    self.handle_discovery(msg);
                }
                else => {
                    break;
                }
            }
        }
    }

    pub fn handle_discovery(&mut self, msg: ServiceDiscoveryMsg) {
        self.balancers.retain(|conf| !msg.removed.contains(conf));
        self.balancers.extend(msg.added);
    }

    pub async fn collect(&self) -> anyhow::Result<SystemState> {
        let client = reqwest::Client::new();
        let mut states = vec![];
        for conf in &self.balancers {
            let mut url = conf.uri();
            url.set_path("/api/state");
            url.set_scheme("http").expect("scheme should be valid");

            let resp = client.get(url).send().await?;
            if !resp.status().is_success() {
                error!("Failed to fetch state from {:?}", &conf);
                continue;
            }
            let state = resp.json::<BalancerState>().await?;
            states.push(state);
        }
        info!("Collected state from {} balancers", states.len());

        Ok(SystemState(states))
    }
}
