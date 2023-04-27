use std::collections::HashMap;

use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::protocol::Message;
use uuid::Uuid;

use crate::protocol;

pub struct SimMonolith {
    pub rooms: HashMap<String, SimRoom>,
}

impl SimMonolith {
    pub fn new() -> Self {
        Self {
            rooms: HashMap::new(),
        }
    }

    pub fn start(mut self) -> (JoinHandle<()>, Sender<Message>, Receiver<Message>) {
        let (inbound_tx, mut inbound_rx) = tokio::sync::mpsc::channel::<Message>(40);
        let (outbound_tx, outbound_rx) = tokio::sync::mpsc::channel::<Message>(40);

        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    msg = inbound_rx.recv() => {
                        self.handle_msg(msg.unwrap(), &outbound_tx).await;
                    }
                }
            }
        });
        (handle, inbound_tx, outbound_rx)
    }

    fn build_message(&self, msg: protocol::Outbound) -> Message {
        Message::text(serde_json::to_string(&msg).unwrap())
    }

    async fn handle_msg(&mut self, msg: Message, outbound_tx: &Sender<Message>) {
        let text = msg.to_text().unwrap();
        let req: crate::protocol::Request = serde_json::from_str(text).unwrap();

        match req {
            protocol::Request::Load { room } => {
                self.load_room(room.clone());
                let msg = protocol::Outbound::Loaded { room };
                outbound_tx.send(self.build_message(msg)).await.unwrap();
            }
            protocol::Request::Join { room, client, .. } => {
                let room = match self.rooms.get_mut(&room) {
                    Some(room) => room,
                    None => {
                        println!("room {} not found, loading", room);
                        self.load_room(room.clone());
                        self.rooms.get_mut(&room).unwrap()
                    }
                };
                room.add_client(client);
            }
            protocol::Request::Leave { client } => {
                let room = self.find_client_room(client).unwrap();
                let room = self.rooms.get_mut(&room).unwrap();
                room.remove_client(client);
            }
            protocol::Request::ClientMsg {
                room,
                client_id,
                payload,
            } => {
                println!(
                    "{}: got message from client {}: {:?}",
                    room, client_id, payload
                );
            }
        }
    }

    pub fn load_room(&mut self, room: String) {
        let room = SimRoom::new(room);
        self.rooms.insert(room.name.clone(), room);
    }

    pub fn unload_room(&mut self, room: &str) {
        self.rooms.remove(room);
    }

    pub fn find_client_room(&self, client: Uuid) -> Option<String> {
        for (name, room) in self.rooms.iter() {
            if room.clients.contains(&client) {
                return Some(name.clone());
            }
        }
        None
    }
}

pub struct SimRoom {
    pub name: String,
    pub clients: Vec<Uuid>,
}

impl SimRoom {
    pub fn new(name: String) -> Self {
        Self {
            name,
            clients: Vec::new(),
        }
    }

    pub fn add_client(&mut self, client: Uuid) {
        self.clients.push(client);
    }

    pub fn remove_client(&mut self, client: Uuid) {
        self.clients.retain(|c| *c != client);
    }
}
