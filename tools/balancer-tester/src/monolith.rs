use std::collections::HashMap;

use ott_balancer_protocol::{ClientId, RoomName};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::protocol::Message;

use ott_balancer_protocol::monolith::*;
use tracing::{info, warn};

pub struct SimMonolith {
    pub rooms: HashMap<RoomName, SimRoom>,
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
                        match msg {
                            Some(msg) => self.handle_msg(msg, &outbound_tx).await,
                            None => break,
                        }
                    }
                }
            }
            info!("connection ended");
        });
        (handle, inbound_tx, outbound_rx)
    }

    fn build_message(&self, msg: impl Into<MsgM2B>) -> Message {
        Message::text(serde_json::to_string(&msg.into()).unwrap())
    }

    async fn handle_msg(&mut self, msg: Message, outbound_tx: &Sender<Message>) {
        let text = msg.to_text().unwrap();
        let req: MsgB2M = serde_json::from_str(text).unwrap();

        match req {
            MsgB2M::Load(msg) => {
                self.load_room(msg.room.clone());
                let room = generate_random_metadata(&msg.room);
                let msg = M2BLoaded {
                    room,
                    load_epoch: 0,
                };
                outbound_tx.send(self.build_message(msg)).await.unwrap();
            }
            MsgB2M::Unload(msg) => todo!(),
            MsgB2M::Join(msg) => {
                let room = match self.rooms.get_mut(&msg.room) {
                    Some(room) => room,
                    None => {
                        warn!("room {} not found, loading", msg.room);
                        self.load_room(msg.room.clone());
                        self.rooms.get_mut(&msg.room).unwrap()
                    }
                };
                room.add_client(msg.client);
            }
            MsgB2M::Leave(msg) => {
                let room = self.find_client_room(msg.client).unwrap();
                let room = self.rooms.get_mut(&room).unwrap();
                room.remove_client(msg.client);
            }
            MsgB2M::ClientMsg(msg) => {
                let room = self
                    .find_client_room(msg.client_id)
                    .expect("client not found in any rooms");
                info!(
                    "{}: got message from client {}: {:?}",
                    room, msg.client_id, msg.payload
                );

                if serde_json::from_str::<SimpleEcho>(msg.payload.get()).is_ok() {
                    let msg = M2BRoomMsg {
                        room,
                        client_id: Some(msg.client_id),
                        payload: msg.payload,
                    };
                    outbound_tx.send(self.build_message(msg)).await.unwrap();
                }
            }
        }
    }

    pub fn load_room(&mut self, room: RoomName) {
        info!("loading room {}", room);
        let room = SimRoom::new(room);
        self.rooms.insert(room.name.clone(), room);
    }

    #[allow(dead_code)]
    pub fn unload_room(&mut self, room: &RoomName) {
        info!("unloading room {}", room);
        self.rooms.remove(room);
    }

    pub fn find_client_room(&self, client: ClientId) -> Option<RoomName> {
        for (name, room) in self.rooms.iter() {
            if room.clients.contains(&client) {
                return Some(name.clone());
            }
        }
        None
    }
}

pub struct SimRoom {
    pub name: RoomName,
    pub clients: Vec<ClientId>,
    pub metadata: RoomMetadata,
}

impl SimRoom {
    pub fn new(name: impl Into<RoomName>) -> Self {
        let name = name.into();
        let metadata = generate_random_metadata(&name);
        Self {
            name,
            clients: Vec::new(),
            metadata,
        }
    }

    pub fn add_client(&mut self, client: ClientId) {
        info!("room[{}]: adding client {}", self.name, client);
        self.clients.push(client);
    }

    pub fn remove_client(&mut self, client: ClientId) {
        info!("room[{}]: removing client {}", self.name, client);
        self.clients.retain(|c| *c != client);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleEcho {
    pub echo: String,
}

fn generate_random_metadata(room: &RoomName) -> RoomMetadata {
    RoomMetadata {
        name: room.clone(),
        title: "foo".to_string(),
        description: "foo".to_string(),
        is_temporary: false,
        visibility: Visibility::Public,
        queue_mode: "manual".to_string(),
        current_source: serde_json::Value::Null,
        users: 2,
    }
}
