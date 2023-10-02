use std::{
    net::{IpAddr, Ipv6Addr, SocketAddr},
    sync::Arc,
};

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::monolith::*;
use tokio::{net::TcpListener, sync::Notify};
use tracing::warn;
use tungstenite::Message;

use crate::TestRunner;

pub struct Monolith {
    pub(crate) listener: Arc<TcpListener>,
    pub(crate) received_raw: Vec<Message>,

    pub(crate) task: tokio::task::JoinHandle<()>,
    pub(crate) outgoing_tx: tokio::sync::mpsc::Sender<Message>,
    pub(crate) incoming_rx: tokio::sync::mpsc::Receiver<Message>,

    monolith_add_tx: tokio::sync::mpsc::Sender<SocketAddr>,
    monolith_remove_tx: tokio::sync::mpsc::Sender<SocketAddr>,

    notif_connect: Arc<Notify>,
    notif_disconnect: Arc<Notify>,
    pub(crate) connected: bool,
}

impl Monolith {
    pub async fn new(ctx: &TestRunner) -> anyhow::Result<Self> {
        // TODO: Binding to port 0 will let the OS allocate a random port for us.
        // for prototyping, using a fixed port.
        let listener =
            Arc::new(TcpListener::bind(SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), 0)).await?);
        let notif_connect = Arc::new(Notify::new());
        let notif_disconnect = Arc::new(Notify::new());

        let (outgoing_tx, mut outgoing_rx) = tokio::sync::mpsc::channel(50);
        let (incoming_tx, incoming_rx) = tokio::sync::mpsc::channel(50);

        let _listener = listener.clone();
        let _notif_connect = notif_connect.clone();
        let _notif_disconnect = notif_disconnect.clone();
        let task = tokio::task::Builder::new()
            .name("emulated monolith")
            .spawn(async move {
                loop {
                    let (stream, addr) = _listener.accept().await.unwrap();
                    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                    let init = M2BInit { port: addr.port() };
                    let msg = serde_json::to_string(&MsgM2B::Init(init)).unwrap();
                    ws.send(Message::Text(msg)).await.unwrap();
                    _notif_connect.notify_one();
                    loop {
                        println!("monolith: waiting for message");
                        tokio::select! {
                            Some(msg) = outgoing_rx.recv() => {
                                ws.send(msg).await.unwrap();
                            }
                            Some(msg) = ws.next() => {
                                match msg {
                                    Ok(msg) => incoming_tx.send(msg).await.unwrap(),
                                    Err(e) => {
                                        warn!("monolith: websocket error: {:?}", e);
                                        break;
                                    }
                                }
                            }
                            else => break,
                        }
                    }
                    _notif_disconnect.notify_one();
                }
            })?;

        Ok(Self {
            listener,
            received_raw: Vec::new(),
            outgoing_tx,
            incoming_rx,
            task,
            monolith_add_tx: ctx.monolith_add_tx.clone(),
            monolith_remove_tx: ctx.monolith_remove_tx.clone(),
            notif_connect,
            notif_disconnect,
            connected: false,
        })
    }

    pub fn port(&self) -> u16 {
        self.listener.local_addr().unwrap().port()
    }

    pub fn connected(&self) -> bool {
        self.connected
    }

    /// Tell the provider to add this monolith to the list of available monoliths.
    pub async fn show(&mut self) {
        println!("showing monolith");
        self.monolith_add_tx
            .send(self.listener.local_addr().unwrap())
            .await
            .unwrap();
        println!("waiting for notification");
        self.notif_connect.notified().await;
        self.connected = true;
    }

    /// Tell the provider to remove this monolith from the list of available monoliths.
    pub async fn hide(&mut self) {
        println!("hiding monolith");
        self.monolith_remove_tx
            .send(self.listener.local_addr().unwrap())
            .await
            .unwrap();
        println!("waiting for notification");
        self.notif_disconnect.notified().await;
        self.connected = false;
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
        self.task.abort();
    }
}
