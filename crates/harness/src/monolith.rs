use std::{
    net::{IpAddr, Ipv6Addr, SocketAddr},
    sync::{Arc, Mutex},
};

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::monolith::*;
use tokio::{net::TcpListener, sync::Notify};
use tracing::warn;
use tungstenite::Message;

use crate::TestRunner;

pub struct Monolith {
    pub(crate) listener: Arc<TcpListener>,

    pub(crate) task: tokio::task::JoinHandle<()>,
    pub(crate) outgoing_tx: tokio::sync::mpsc::Sender<Message>,
    // pub(crate) incoming_rx: tokio::sync::mpsc::Receiver<Message>,
    monolith_add_tx: tokio::sync::mpsc::Sender<SocketAddr>,
    monolith_remove_tx: tokio::sync::mpsc::Sender<SocketAddr>,

    notif_connect: Arc<Notify>,
    notif_disconnect: Arc<Notify>,
    notif_recv: Arc<Notify>,

    state: Arc<Mutex<MonolithState>>,
}

pub(crate) struct MonolithState {
    connected: bool,
    received_raw: Vec<Message>,
}

impl Monolith {
    pub async fn new(ctx: &TestRunner) -> anyhow::Result<Self> {
        // TODO: Binding to port 0 will let the OS allocate a random port for us.
        // for prototyping, using a fixed port.
        let listener =
            Arc::new(TcpListener::bind(SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), 0)).await?);
        let notif_connect = Arc::new(Notify::new());
        let notif_disconnect = Arc::new(Notify::new());
        let notif_recv = Arc::new(Notify::new());

        let (outgoing_tx, mut outgoing_rx) = tokio::sync::mpsc::channel(50);
        // let (incoming_tx, incoming_rx) = tokio::sync::mpsc::channel(50);

        let state = Arc::new(Mutex::new(MonolithState {
            connected: false,
            received_raw: Vec::new(),
        }));

        let _listener = listener.clone();
        let _notif_connect = notif_connect.clone();
        let _notif_disconnect = notif_disconnect.clone();
        let _notif_recv = notif_recv.clone();
        let _state = state.clone();
        let task = tokio::task::Builder::new()
            .name("emulated monolith")
            .spawn(async move {
                let state = _state;
                loop {
                    let (stream, addr) = _listener.accept().await.unwrap();
                    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                    let init = M2BInit { port: addr.port() };
                    let msg = serde_json::to_string(&MsgM2B::Init(init)).unwrap();
                    ws.send(Message::Text(msg)).await.unwrap();
                    state.lock().unwrap().connected = true;
                    _notif_connect.notify_one();
                    loop {
                        println!("monolith: waiting for message");
                        tokio::select! {
                            Some(msg) = outgoing_rx.recv() => {
                                ws.send(msg).await.unwrap();
                            }
                            Some(msg) = ws.next() => {
                                match msg {
                                    Ok(msg) => {
                                        println!("monolith: incoming msg: {}", msg);
                                        state.lock().unwrap().received_raw.push(msg);
                                        _notif_recv.notify_one();
                                    },
                                    Err(e) => {
                                        warn!("monolith: websocket error: {:?}", e);
                                        break;
                                    }
                                }
                            }
                            else => break,
                        }
                    }
                    state.lock().unwrap().connected = false;
                    _notif_disconnect.notify_one();
                }
            })?;

        Ok(Self {
            listener,
            outgoing_tx,
            // incoming_rx,
            task,
            monolith_add_tx: ctx.monolith_add_tx.clone(),
            monolith_remove_tx: ctx.monolith_remove_tx.clone(),
            notif_connect,
            notif_disconnect,
            notif_recv,
            state,
        })
    }

    pub fn port(&self) -> u16 {
        self.listener.local_addr().unwrap().port()
    }

    pub fn connected(&self) -> bool {
        self.state.lock().unwrap().connected
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
    }

    /// Wait until the next message is received.
    pub async fn wait_recv(&self) {
        self.notif_recv.notified().await;
    }

    pub fn clear_recv(&mut self) {
        self.state.lock().unwrap().received_raw.clear();
    }

    pub async fn send_raw(&mut self, msg: impl Into<Message>) {
        self.outgoing_tx.send(msg.into()).await.unwrap();
    }

    pub async fn send(&mut self, msg: impl Into<MsgM2B>) {
        let msg = serde_json::to_string(&msg.into()).unwrap();
        self.send_raw(Message::Text(msg)).await;
    }

    pub fn collect_recv(&self) -> Vec<MsgB2M> {
        self.state
            .lock()
            .unwrap()
            .received_raw
            .iter()
            .filter_map(|msg| match msg {
                Message::Text(msg) => {
                    let msg: MsgB2M = serde_json::from_str(msg).unwrap();
                    Some(msg)
                }
                _ => None,
            })
            .collect()
    }
}

impl Drop for Monolith {
    fn drop(&mut self) {
        self.task.abort();
    }
}
