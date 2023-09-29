use std::{
    net::{IpAddr, Ipv6Addr, SocketAddr},
    sync::Arc,
};

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::monolith::*;
use tokio::net::TcpListener;
use tungstenite::Message;

use crate::TestRunner;

pub struct Monolith {
    pub(crate) listener: Arc<TcpListener>,
    pub(crate) received_raw: Vec<Message>,

    pub(crate) task: tokio::task::JoinHandle<()>,
    pub(crate) outgoing_tx: tokio::sync::mpsc::Sender<Message>,
    pub(crate) incoming_rx: tokio::sync::mpsc::Receiver<Message>,

    monolith_remove_tx: tokio::sync::mpsc::Sender<SocketAddr>,
}

impl Monolith {
    pub async fn new(ctx: &TestRunner) -> anyhow::Result<Self> {
        // TODO: Binding to port 0 will let the OS allocate a random port for us.
        // for prototyping, using a fixed port.
        let listener = Arc::new(
            TcpListener::bind(SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), 35277)).await?,
        );

        let (outgoing_tx, mut outgoing_rx) = tokio::sync::mpsc::channel(50);
        let (incoming_tx, incoming_rx) = tokio::sync::mpsc::channel(50);

        let _listener = listener.clone();
        let task = tokio::task::Builder::new()
            .name("emulated monolith")
            .spawn(async move {
                loop {
                    let (stream, addr) = _listener.accept().await.unwrap();
                    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                    let init = M2BInit { port: addr.port() };
                    let msg = serde_json::to_string(&MsgM2B::Init(init)).unwrap();
                    ws.send(Message::Text(msg)).await.unwrap();
                    loop {
                        tokio::select! {
                            Some(msg) = outgoing_rx.recv() => {
                                ws.send(msg).await.unwrap();
                            }
                            Some(msg) = ws.next() => {
                                incoming_tx.send(msg.unwrap()).await.unwrap();
                            }
                            else => break,
                        }
                    }
                }
            })?;

        ctx.monolith_add_tx
            .send(listener.local_addr().unwrap())
            .await
            .unwrap();

        Ok(Self {
            listener,
            received_raw: Vec::new(),
            outgoing_tx,
            incoming_rx,
            task,
            monolith_remove_tx: ctx.monolith_remove_tx.clone(),
        })
    }

    pub fn port(&self) -> u16 {
        self.listener.local_addr().unwrap().port()
    }

    pub async fn recv(&mut self) {
        while let Some(msg) = self.incoming_rx.recv().await {
            self.received_raw.push(msg);
        }
    }

    pub fn clear_recv(&mut self) {
        self.received_raw.clear();
    }

    pub async fn send_raw(&mut self, msg: Message) {
        self.outgoing_tx.send(msg).await.unwrap();
    }

    pub async fn send(&mut self, msg: impl Into<MsgM2B>) {
        let msg = serde_json::to_string(&msg.into()).unwrap();
        self.send_raw(Message::Text(msg)).await;
    }
}

impl Drop for Monolith {
    fn drop(&mut self) {
        self.monolith_remove_tx
            .blocking_send(self.listener.local_addr().unwrap())
            .expect("failed to send monolith remove message to provider");
        self.task.abort();
    }
}
