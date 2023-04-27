use std::collections::HashMap;

use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::protocol::Message;
use uuid::Uuid;

pub struct SimMonolith {
    pub rooms: HashMap<String, SimRoom>,
}

impl SimMonolith {
    pub fn new() -> Self {
        Self {
            rooms: HashMap::new(),
        }
    }

    pub fn start(self) -> (JoinHandle<()>, Sender<Message>, Receiver<Message>) {
        let (inbound_tx, mut inbound_rx) = tokio::sync::mpsc::channel::<Message>(40);
        let (outbound_tx, outbound_rx) = tokio::sync::mpsc::channel::<Message>(40);

        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    msg = inbound_rx.recv() => {
                        if let Some(msg) = msg {
                            outbound_tx.send(msg).await.unwrap();
                        }
                    }
                }
            }
        });
        (handle, inbound_tx, outbound_rx)
    }

    pub fn load_room(&mut self, room: SimRoom) {
        self.rooms.insert(room.name.clone(), room);
    }

    pub fn unload_room(&mut self, room: &str) {
        self.rooms.remove(room);
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
