use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use rocket_ws as ws;
use uuid::Uuid;

use tokio::sync::{
    mpsc::{Receiver, Sender},
    Mutex,
};

use crate::client::{BalancerClient, MessageReceiver, NewClient, OttMonolith};

pub struct BalancerContext {
    pub monoliths: Vec<OttMonolith>,
    clients: Vec<BalancerClient>,
}

impl BalancerContext {
    pub fn new() -> Self {
        Self {
            monoliths: Vec::new(),
            clients: Vec::new(),
        }
    }

    fn add_client(&mut self, client: BalancerClient) {
        self.clients.push(client);
    }

    fn add_monolith(&mut self, monolith: OttMonolith) {
        self.monoliths.push(monolith);
    }
}

pub struct OttBalancer {
    pub monoliths: Vec<OttMonolith>,
    clients: Vec<BalancerClient>,

    /// Channel for receiving messages from clients.
    c2b_recv: tokio::sync::mpsc::Receiver<X2BSocketMessage>,
    /// Channel for allowing clients to send messages to the balancer.
    c2b_send: tokio::sync::mpsc::Sender<X2BSocketMessage>,

    /// Channel for receiving messages from monoliths.
    m2b_recv: Receiver<X2BSocketMessage>,
    /// Channel for allowing monoliths to send messages to the balancer.
    m2b_send: Sender<X2BSocketMessage>,
}

impl OttBalancer {
    pub fn new() -> Self {
        let (c2b_send, c2b_recv) = tokio::sync::mpsc::channel::<X2BSocketMessage>(100);
        let (m2b_send, m2b_recv) = tokio::sync::mpsc::channel::<X2BSocketMessage>(100);
        Self {
            // context: Arc::new(Mutex::new(BalancerContext::new())),
            monoliths: Vec::new(),
            clients: Vec::new(),

            c2b_recv,
            c2b_send,
            m2b_recv,
            m2b_send,
        }
    }

    pub(crate) async fn tick(&mut self) {
        tokio::select! {
            Some(message) = self.c2b_recv.recv() => {
                match message {
                    X2BSocketMessage::Message { node_id, message } => {
                        println!("got message from client: {:?}", message);
                        let client = self.clients.iter_mut().find(|client| client.client.id == node_id).unwrap();
                        client.send(B2XSocketMessage::Message(message)).await.unwrap();
                    }
                    X2BSocketMessage::Close { node_id } => {
                        println!("got close message from client");
                        self.clients.retain(|client| {
                            client.client.id != node_id
                        });
                    }
                }
            }
            Some(message) = self.m2b_recv.recv() => {
                match message {
                    X2BSocketMessage::Message { node_id, message } => {
                        println!("got message from monolith: {:?}", message);
                        let monolith = self.monoliths.iter_mut().find(|monolith| monolith.id == node_id).unwrap();
                        monolith.send(B2XSocketMessage::Message(message)).await.unwrap();
                    }
                    X2BSocketMessage::Close { node_id } => {
                        println!("got close message from monolith");
                        self.monoliths.retain(|monolith| {
                            monolith.id != node_id
                        });
                    }
                }
            }
        }
    }

    pub fn handle_client(&mut self, client: NewClient, mut stream: ws::stream::DuplexStream) {
        let send = self.c2b_send.clone();
        let client_id = client.id;
        let (b2c_send, mut b2c_recv) = tokio::sync::mpsc::channel::<B2XSocketMessage>(10);
        let join_handle = tokio::spawn(async move {
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
                                send.send(X2BSocketMessage::Message {
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
            send.send(X2BSocketMessage::Close { node_id: client_id })
                .await
                .unwrap()
        });
        self.clients
            .push(BalancerClient::new(client, b2c_send, join_handle));
    }

    pub fn handle_monolith(&mut self, mut stream: ws::stream::DuplexStream) {
        let send = self.m2b_send.clone();
        let monolith_id = Uuid::new_v4();
        let (b2m_send, mut b2m_recv) = tokio::sync::mpsc::channel::<B2XSocketMessage>(10);
        let join_handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    Some(message) = b2m_recv.recv() => {
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
                                println!("got message from monolith: {:?}", message);
                                send.send(X2BSocketMessage::Message {
                                    node_id: monolith_id,
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
            println!("monolith disconnected");
        });
        let monolith = OttMonolith::new(monolith_id, join_handle, b2m_send);
        self.monoliths.push(monolith);
    }

    pub fn process_gossip(&mut self) {
        todo!("implement gossip processing");
    }

    pub fn find_monolith(&self, room: &str) -> Option<&OttMonolith> {
        // TODO: implement a more efficient data structure
        self.monoliths
            .iter()
            .find(|m| m.rooms.contains(&room.to_string()))
    }
}

#[derive(Debug)]
pub enum X2BSocketMessage {
    Message { node_id: Uuid, message: ws::Message },
    Close { node_id: Uuid },
}

#[derive(Debug)]
pub enum B2XSocketMessage {
    Message(ws::Message),
    Close,
}
