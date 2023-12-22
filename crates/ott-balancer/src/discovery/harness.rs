use std::sync::Arc;

use futures_util::StreamExt;
use ott_balancer_protocol::harness::HarnessMonoliths;
use serde::Deserialize;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use super::*;

#[derive(Debug, Clone, Deserialize)]
pub struct HarnessDiscoveryConfig {
    /// The port to listen on for the harness to connect to.
    pub port: u16,
}

pub struct HarnessMonolithDiscoverer {
    config: HarnessDiscoveryConfig,
    monoliths: Arc<Mutex<HarnessMonoliths>>,
    updated_rx: tokio::sync::mpsc::Receiver<()>,

    task: JoinHandle<anyhow::Result<()>>,
}

impl HarnessMonolithDiscoverer {
    pub fn new(config: HarnessDiscoveryConfig) -> Self {
        let monoliths = Arc::new(Mutex::new(HarnessMonoliths::default()));

        let (updated_rx, task) = Self::start(&monoliths, config.clone());

        Self {
            config,
            monoliths,
            updated_rx,
            task,
        }
    }

    fn start(
        monoliths: &Arc<Mutex<HarnessMonoliths>>,
        config: HarnessDiscoveryConfig,
    ) -> (
        tokio::sync::mpsc::Receiver<()>,
        JoinHandle<anyhow::Result<()>>,
    ) {
        let (updated_tx, updated_rx) = tokio::sync::mpsc::channel(5);

        let _monoliths = monoliths.clone();
        let task = tokio::task::Builder::new()
            .name("harness discoverer")
            .spawn(async move { do_harness_discovery(_monoliths, config, updated_tx).await })
            .expect("failed to spawn harness discoverer task");
        (updated_rx, task)
    }
}

async fn do_harness_discovery(
    monoliths: Arc<Mutex<HarnessMonoliths>>,
    config: HarnessDiscoveryConfig,
    updated_tx: tokio::sync::mpsc::Sender<()>,
) -> anyhow::Result<()> {
    info!("Binding harness discoverer to port {}", config.port);
    let listener = tokio::net::TcpListener::bind(("::", config.port)).await?;
    loop {
        info!("Waiting for harness to connect");
        let Ok((stream, _)) = listener.accept().await else {
            error!("failed to accept tcp connection from harness");
            continue;
        };
        let Ok(mut ws) = tokio_tungstenite::accept_async(stream).await else {
            error!("failed to accept websocket connection from harness");
            continue;
        };
        info!("Harness connected");

        loop {
            match ws.next().await {
                Some(Ok(msg)) => {
                    let Ok(text) = msg.into_text() else {
                        error!(
                            "expected text message from harness, got something else"
                        );
                        continue;
                    };
                    let Ok(msg) = serde_json::from_str(text.as_str()) else {
                        error!("failed to deserialize message from harness");
                        continue;
                    };
                    let mut monoliths = monoliths.lock().await;
                    *monoliths = msg;
                    info!("updated monoliths: {:?}", *monoliths);
                    if let Err(e) = updated_tx.send(()).await {
                        error!(
                            "failed to send update notification to discovery task: {}",
                            e
                        );
                    }
                }
                Some(Err(e)) => {
                    error!("error receiving message from harness: {}", e);
                }
                None => {
                    warn!("harness closed connection");
                    break;
                }
            }
        }
    }
}

#[async_trait]
impl MonolithDiscoverer for HarnessMonolithDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        let result = self
            .updated_rx
            .recv()
            .await
            .ok_or_else(|| anyhow::anyhow!("harness discoverer task died unexpectedly"));
        if let Err(e) = &result {
            error!(
                "harness discoverer task died: {} -- handle: {:?} is_finished={}",
                e,
                self.task,
                self.task.is_finished()
            );

            info!("restarting harness discoverer task");
            let (updated_rx, task) =
                HarnessMonolithDiscoverer::start(&self.monoliths, self.config.clone());
            self.updated_rx = updated_rx;
            let prevtask = std::mem::replace(&mut self.task, task);
            error!("previous task exited with: {:?}", prevtask.await?);
        }
        Ok(self
            .monoliths
            .lock()
            .await
            .0
            .iter()
            .map(|addr| (*addr).into())
            .collect())
    }

    fn mode(&self) -> DiscoveryMode {
        DiscoveryMode::Continuous
    }
}

impl Drop for HarnessMonolithDiscoverer {
    fn drop(&mut self) {
        self.task.abort();
    }
}
