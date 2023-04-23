use futures_util::{SinkExt, StreamExt};
use rocket_ws as ws;
use std::collections::HashMap;
use uuid::Uuid;

pub struct OttMonolith {
    pub rooms: Vec<String>,
    pub load: f64,
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

struct BalancerClient {
    client: NewClient,
    send: tokio::sync::mpsc::Sender<B2CSocketMessage>,
    join_handle: tokio::task::JoinHandle<()>,
}

pub struct OttBalancer {
    pub monoliths: Vec<OttMonolith>,
    clients: Vec<BalancerClient>,

    /// Channel for receiving messages from clients.
    c2b_client_recv: tokio::sync::mpsc::Receiver<C2BSocketMessage>,
    /// Channel for allowing clients to send messages to the balancer.
    c2b_client_send: tokio::sync::mpsc::Sender<C2BSocketMessage>,
}

impl OttBalancer {
    pub fn new() -> Self {
        let (c2b_client_send, c2b_client_recv) =
            tokio::sync::mpsc::channel::<C2BSocketMessage>(100);
        Self {
            monoliths: Vec::new(),
            clients: Vec::new(),
            c2b_client_recv,
            c2b_client_send,
        }
    }

    pub fn handle_client(&mut self, client: NewClient, mut stream: ws::stream::DuplexStream) {
        let send = self.c2b_client_send.clone();
        let client_id = client.id.clone();
        let (b2c_send, mut b2c_recv) = tokio::sync::mpsc::channel::<B2CSocketMessage>(10);
        let join_handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    Some(message) = b2c_recv.recv() => {
                        match message {
                            B2CSocketMessage::Message(message) => {
                                stream.send(message).await.unwrap();
                            }
                            B2CSocketMessage::Close => {
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
                                    client_id: client_id.clone(),
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
            send.send(C2BSocketMessage::Close).await.unwrap()
        });
        self.clients.push(BalancerClient {
            client,
            send: b2c_send,
            join_handle,
        });
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
enum C2BSocketMessage {
    Message {
        client_id: Uuid,
        message: ws::Message,
    },
    Close,
}

#[derive(Debug)]
enum B2CSocketMessage {
    Message(ws::Message),
    Close,
}
