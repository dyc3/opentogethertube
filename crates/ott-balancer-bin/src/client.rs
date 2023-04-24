use futures_util::{SinkExt, StreamExt};
use rocket_ws as ws;
use tokio::sync::mpsc::{Receiver, Sender};
use uuid::Uuid;

use crate::balancer::{B2XSocketMessage, C2BSocketMessage};

/// A type that implements this trait can receive messages from the [`OttBalancer`].
#[async_trait]
pub trait MessageReceiver {
    async fn send(&mut self, message: B2XSocketMessage) -> anyhow::Result<()>;
}

pub struct OttMonolith {
    pub id: Uuid,
    pub rooms: Vec<String>,
    pub load: f64,

    pub join_handle: tokio::task::JoinHandle<()>,
    // m2b_recv: Receiver<X2BSocketMessage>,
    b2m_send: Sender<B2XSocketMessage>,
}

impl OttMonolith {
    pub fn new(
        id: Uuid,
        join_handle: tokio::task::JoinHandle<()>,

        b2m_send: Sender<B2XSocketMessage>,
    ) -> Self {
        Self {
            id,
            rooms: vec![],
            load: 0.0,

            join_handle,
            b2m_send,
        }
    }
}

#[async_trait]
impl MessageReceiver for OttMonolith {
    async fn send(&mut self, message: B2XSocketMessage) -> anyhow::Result<()> {
        self.b2m_send.send(message).await?;
        Ok(())
    }
}

pub struct UnauthorizedClient {
    pub id: Uuid,
    pub room: String,
}

impl UnauthorizedClient {
    pub fn into_new_client(self, token: String) -> NewClient {
        NewClient {
            id: self.id,
            room: self.room,
            token,
        }
    }
}

/// Represents a client websocket connection's context. Used by [`OttBalancer`] to make a [`BalancerClient`].
pub struct NewClient {
    pub id: Uuid,
    pub room: String,
    pub token: String,
}

pub(crate) struct BalancerClient {
    pub client: NewClient,
    b2c_send: tokio::sync::mpsc::Sender<B2XSocketMessage>,
    pub join_handle: tokio::task::JoinHandle<()>,
}

impl BalancerClient {
    pub fn new(
        client: NewClient,
        b2c_send: tokio::sync::mpsc::Sender<B2XSocketMessage>,
        join_handle: tokio::task::JoinHandle<()>,
    ) -> Self {
        Self {
            client,
            b2c_send,
            join_handle,
        }
    }
}

#[async_trait]
impl MessageReceiver for BalancerClient {
    async fn send(&mut self, message: B2XSocketMessage) -> anyhow::Result<()> {
        self.b2c_send.send(message).await?;
        Ok(())
    }
}

pub async fn client_msg_passer(
    client_id: Uuid,
    mut stream: ws::stream::DuplexStream,
    send: Sender<C2BSocketMessage>,
    mut b2c_recv: Receiver<B2XSocketMessage>,
) {
    loop {
        tokio::select! {
            Some(message) = b2c_recv.recv() => {
                match message {
                    B2XSocketMessage::Message(message) => {
                        stream.send(message).await.unwrap();
                    }
                    B2XSocketMessage::Close => {
                        stream.close(Some(ws::frame::CloseFrame {
                            code: ws::frame::CloseCode::Library(4000),
                            reason: "unknown".into(),
                        })).await.unwrap();
                        break;
                    }
                }
            }
            Some(message) = stream.next() => {
                match message {
                    Ok(message) => {
                        println!("got message: {:?}", message);
                        send.send(C2BSocketMessage::Message {
                            node_id: client_id,
                            message,
                        })
                        .await
                        .unwrap()
                    }
                    Err(e) => {
                        println!("error: {}", e);
                        break;
                    }
                }
            }
        }
    }
    println!("client disconnected");
    send.send(C2BSocketMessage::Close { node_id: client_id })
        .await
        .unwrap()
}
