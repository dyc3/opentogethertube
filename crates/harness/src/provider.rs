use std::{collections::HashSet, net::SocketAddr};

use futures_util::SinkExt;
use ott_balancer_protocol::harness::HarnessMonoliths;
use tokio::{net::TcpStream, task::JoinHandle};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
use tungstenite::Message;

#[derive(Debug)]
pub(crate) struct DiscoveryProvider {
    monolith_add_rx: tokio::sync::mpsc::Receiver<SocketAddr>,
    monolith_remove_rx: tokio::sync::mpsc::Receiver<SocketAddr>,

    websocket: WebSocketStream<MaybeTlsStream<TcpStream>>,

    monoliths: HashSet<SocketAddr>,
}

impl DiscoveryProvider {
    pub(crate) async fn connect(
        port: u16,
    ) -> (
        JoinHandle<()>,
        tokio::sync::mpsc::Sender<SocketAddr>,
        tokio::sync::mpsc::Sender<SocketAddr>,
    ) {
        let (monolith_add_tx, monolith_add_rx) = tokio::sync::mpsc::channel(50);
        let (monolith_remove_tx, monolith_remove_rx) = tokio::sync::mpsc::channel(50);
        let (ws, _) = tokio_tungstenite::connect_async(format!("ws://localhost:{}", port))
            .await
            .unwrap();
        let provider = Self {
            monolith_add_rx,
            monolith_remove_rx,

            websocket: ws,
            monoliths: Default::default(),
        };

        let task = tokio::task::spawn(async move {
            provider.start().await;
        });

        return (task, monolith_add_tx, monolith_remove_tx);
    }

    async fn start(mut self) {
        loop {
            tokio::select! {
                Some(addr) = self.monolith_add_rx.recv() => {
                    self.monoliths.insert(addr);
                }
                Some(addr) = self.monolith_remove_rx.recv() => {
                    self.monoliths.remove(&addr);
                }
                else => break,
            }
            let msg = HarnessMonoliths(self.monoliths.iter().copied().collect());
            let text = serde_json::to_string(&msg).unwrap();
            self.websocket.send(Message::Text(text)).await.unwrap();
        }
    }
}
