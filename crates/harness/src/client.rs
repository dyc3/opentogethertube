use std::net::{Ipv4Addr, SocketAddr};

use futures_util::SinkExt;
use ott_balancer_protocol::client::*;
use rand::{distributions::Alphanumeric, Rng};
use serde::Serialize;
use tokio::{io::Interest, net::TcpStream};
use tokio_tungstenite::WebSocketStream;
use tungstenite::Message;

use crate::TestRunner;

pub struct Client {
    addr: SocketAddr,
    pub(crate) stream: Option<WebSocketStream<TcpStream>>,
    // pub(crate) task: tokio::task::JoinHandle<()>,
    // pub(crate) outgoing_tx: tokio::sync::mpsc::Sender<Message>,
    // pub(crate) incoming_rx: tokio::sync::mpsc::Receiver<Message>,
    // notif_connect: Arc<Notify>,
    // notif_disconnect: Arc<Notify>,
}

impl Client {
    pub fn new(ctx: &TestRunner) -> anyhow::Result<Self> {
        // let notif_connect = Arc::new(Notify::new());
        // let notif_disconnect = Arc::new(Notify::new());

        // let (outgoing_tx, mut outgoing_rx) = tokio::sync::mpsc::channel(50);
        // let (incoming_tx, incoming_rx) = tokio::sync::mpsc::channel(50);

        Ok(Self {
            addr: SocketAddr::new(Ipv4Addr::LOCALHOST.into(), ctx.port),
            stream: None,
            // notif_connect,
            // notif_disconnect,
        })
    }

    /// Connect to the balancer, targeting the given room.
    pub async fn connect(&mut self, room: impl AsRef<str>) {
        assert!(!self.connected(), "already connected");

        let stream = tokio::net::TcpStream::connect(self.addr).await.unwrap();
        let (stream, _) = tokio_tungstenite::client_async(
            format!(
                "ws://localhost:{}/api/room/{}",
                self.addr.port(),
                room.as_ref()
            ),
            stream,
        )
        .await
        .unwrap();

        self.stream = Some(stream);
    }

    /// Send the auth message to the balancer.
    pub async fn auth(&mut self) {
        let auth = ClientMessage::Auth(ClientMessageAuth {
            token: rand::thread_rng()
                .sample_iter(&Alphanumeric)
                .take(40)
                .map(char::from)
                .collect(),
        });

        self.send(auth).await;
    }

    pub async fn send_raw(&mut self, msg: impl Into<Message>) {
        assert!(self.connected(), "not connected");

        if let Some(stream) = self.stream.as_mut() {
            stream
                .send(msg.into())
                .await
                .expect("failed to send message");
        }
    }

    pub async fn send(&mut self, msg: impl Serialize) {
        let msg = serde_json::to_string(&msg).unwrap();
        self.send_raw(Message::Text(msg)).await;
    }

    /// Connect to the balancer, targeting the given room, and send the auth message.
    ///
    /// Equivalent to calling [`connect`] and [`auth`] in sequence.
    pub async fn join(&mut self, room: impl AsRef<str>) {
        self.connect(room).await;
        self.auth().await;
    }

    pub fn connected(&self) -> bool {
        if let Some(stream) = &self.stream {
            stream.get_ref().peer_addr().is_ok()
        } else {
            false
        }
    }

    pub async fn disconnect(&mut self) {
        assert!(self.connected(), "not connected");

        let mut stream = self.stream.take().unwrap();
        stream.close(None).await.unwrap();
    }
}
