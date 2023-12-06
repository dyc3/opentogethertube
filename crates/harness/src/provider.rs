use std::{collections::HashSet, net::SocketAddr};

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::harness::HarnessMonoliths;
use tokio::task::JoinHandle;
use tungstenite::Message;

#[derive(Debug)]
pub(crate) struct DiscoveryProvider {
    monolith_add_rx: tokio::sync::mpsc::Receiver<SocketAddr>,
    monolith_remove_rx: tokio::sync::mpsc::Receiver<SocketAddr>,
    port: u16,

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

        let provider = Self {
            monolith_add_rx,
            monolith_remove_rx,
            port,

            monoliths: Default::default(),
        };

        let task = tokio::task::spawn(async move {
            provider.start().await;
        });

        (task, monolith_add_tx, monolith_remove_tx)
    }

    async fn start(mut self) {
        loop {
            println!("Provider: Connecting to balancer");
            let Ok((mut ws, _)) = tokio_tungstenite::connect_async(format!("ws://[::]:{}", self.port)).await else {
                println!("Provider: Failed to connect to balancer, retrying in 1s");
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            };
            println!("Provider: Connected to balancer");

            loop {
                // Do this first to make sure we tell the balancer about all the monoliths we know about.
                let msg = HarnessMonoliths(self.monoliths.iter().copied().collect());
                let text = serde_json::to_string(&msg).unwrap();
                ws.send(Message::Text(text)).await.unwrap();

                tokio::select! {
                    Some(addr) = self.monolith_add_rx.recv() => {
                        self.monoliths.insert(addr);
                    }
                    Some(addr) = self.monolith_remove_rx.recv() => {
                        self.monoliths.remove(&addr);
                    }
                    msg = ws.next() => match msg {
                        Some(Ok(Message::Close(_))) => break,
                        Some(Ok(_)) => {}
                        Some(Err(_)) => break,
                        None => break,
                    }
                }
            }
            println!("Provider: Lost connection to balancer, reconnecting in 1s");
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }
}
