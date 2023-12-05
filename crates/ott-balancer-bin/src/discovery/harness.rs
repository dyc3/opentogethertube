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
    monoliths: Arc<Mutex<HarnessMonoliths>>,
    updated_rx: tokio::sync::mpsc::Receiver<()>,

    task: JoinHandle<()>,
}

impl HarnessMonolithDiscoverer {
    pub fn new(config: HarnessDiscoveryConfig) -> Self {
        let monoliths = Arc::new(Mutex::new(HarnessMonoliths::default()));

        let (updated_tx, updated_rx) = tokio::sync::mpsc::channel(1);

        let _monoliths = monoliths.clone();
        let task = tokio::task::Builder::new()
            .name("harness discoverer")
            .spawn(async move {
                let monoliths = _monoliths;
                info!("Binding harness discoverer to port {}", config.port);
                let listener = tokio::net::TcpListener::bind(("::", config.port))
                    .await
                    .expect("failed to bind to port");
                loop {
                    info!("Waiting for harness to connect");
                    let (stream, _) = listener.accept().await.unwrap();
                    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
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
                                updated_tx.send(()).await.unwrap();
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
            })
            .expect("failed to spawn harness discoverer task");

        Self {
            monoliths,
            updated_rx,
            task,
        }
    }
}

#[async_trait]
impl MonolithDiscovery for HarnessMonolithDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        self.updated_rx.recv().await;
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
