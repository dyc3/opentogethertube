use futures_util::StreamExt;
use rocket_ws as ws;
use std::collections::HashMap;

pub struct OttMonolith {
    pub rooms: Vec<String>,
    pub load: f64,
}

pub struct UnauthorizedClient {
    pub id: String,
    pub room: String,
}

impl UnauthorizedClient {
    pub fn into_client(self, token: String) -> Client {
        Client {
            id: self.id,
            room: self.room,
            token,
        }
    }
}

pub struct Client {
    pub id: String,
    pub room: String,
    pub token: String,
}

struct BalancerClient {
    client: Client,
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

    pub fn handle_client(&mut self, client: Client, mut stream: ws::stream::DuplexStream) {
        let send = self.c2b_client_send.clone();
        let client_id = client.id.clone();
        self.clients.push(BalancerClient { client });
        tokio::spawn(async move {
            while let Some(message) = stream.next().await {
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
            println!("client disconnected");
            send.send(C2BSocketMessage::Close).await.unwrap()
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
        client_id: String,
        message: ws::Message,
    },
    Close,
}

#[derive(Debug)]
enum B2CSocketMessage {
    Message(ws::Message),
    Close,
}
