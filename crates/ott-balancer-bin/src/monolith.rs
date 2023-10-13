use std::collections::HashMap;

use ott_balancer_protocol::monolith::*;
use ott_balancer_protocol::*;
use tokio_tungstenite::tungstenite::Message;
use tracing::error;

use crate::discovery::MonolithConnectionConfig;
use crate::messages::*;

/// A Monolith refers to the NodeJS server that manages rooms and performs all business logic.
#[derive(Debug)]
pub struct BalancerMonolith {
    id: MonolithId,
    rooms: HashMap<RoomName, Room>,
    socket_tx: tokio::sync::mpsc::Sender<SocketMessage>,
    config: MonolithConnectionConfig,
    proxy_port: u16,
    http_client: reqwest::Client,
}

impl BalancerMonolith {
    pub fn new(m: NewMonolith, socket_tx: tokio::sync::mpsc::Sender<SocketMessage>) -> Self {
        Self {
            id: m.id,
            rooms: HashMap::new(),
            socket_tx,
            config: m.config,
            proxy_port: m.proxy_port,
            http_client: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .expect("failed to build http client"),
        }
    }

    pub fn id(&self) -> MonolithId {
        self.id
    }

    pub fn rooms(&self) -> &HashMap<RoomName, Room> {
        &self.rooms
    }

    pub fn config(&self) -> &MonolithConnectionConfig {
        &self.config
    }

    /// The network port that can be used to send proxied HTTP requests to this Monolith.
    pub fn proxy_port(&self) -> u16 {
        self.proxy_port
    }

    pub fn http_client(&self) -> &reqwest::Client {
        &self.http_client
    }

    pub fn add_room(&mut self, room: Room) {
        if self.rooms.contains_key(&room.name) {
            error!("Monolith already has room {}", room.name);
            return;
        }
        self.rooms.insert(room.name.clone(), room);
    }

    pub fn remove_room(&mut self, room: &RoomName) {
        self.rooms.remove(room);
    }

    pub fn has_room(&self, room: &RoomName) -> bool {
        self.rooms.contains_key(room)
    }

    pub fn add_client(&mut self, room: &RoomName, client_id: ClientId) {
        let room = self
            .rooms
            .entry(room.clone())
            .or_insert_with(|| Room::new(room.clone()));
        room.add_client(client_id);
    }

    pub fn remove_client(&mut self, client_id: ClientId) {
        for (_, room) in self.rooms.iter_mut() {
            room.remove_client(client_id);
        }
    }

    pub async fn send(&self, msg: impl Into<MsgB2M>) -> anyhow::Result<()> {
        let text = serde_json::to_string(&msg.into())?;
        let socket_msg = Message::Text(text).into();
        self.socket_tx.send(socket_msg).await?;

        Ok(())
    }

    pub fn set_room_metadata(&mut self, metadata: RoomMetadata) {
        let room = metadata.name.clone();
        let Some(room) = self.rooms.get_mut(&room) else {
            error!(
                "Error setting metadata, Monolith {} does not have room {}",
                self.id, room
            );
            return;
        };
        room.set_metadata(metadata);
    }

    pub fn add_or_sync_room(&mut self, metadata: RoomMetadata) {
        if self.has_room(&metadata.name) {
            self.set_room_metadata(metadata);
        } else {
            let mut room = Room::new(metadata.name.clone());
            room.set_metadata(metadata);
            self.add_room(room);
        }
    }
}

/// Directly corresponds to a room on a Monolith.
#[derive(Debug)]
pub struct Room {
    name: RoomName,
    /// List of clients connected to this Balancer that are in this room.
    clients: Vec<ClientId>,
    /// Metadata about this room, according to the Monolith.
    metadata: Option<RoomMetadata>,
}

impl Room {
    pub fn new(name: RoomName) -> Self {
        Self {
            name,
            clients: Vec::new(),
            metadata: None,
        }
    }

    pub fn name(&self) -> &RoomName {
        &self.name
    }

    pub fn metadata(&self) -> Option<&RoomMetadata> {
        self.metadata.as_ref()
    }

    pub fn set_metadata(&mut self, metadata: RoomMetadata) {
        self.metadata = Some(metadata);
    }

    pub fn clients(&self) -> &Vec<ClientId> {
        &self.clients
    }

    pub fn add_client(&mut self, client: ClientId) {
        self.clients.push(client);
    }

    pub fn remove_client(&mut self, client: ClientId) {
        self.clients.retain(|c| *c != client);
    }
}

#[derive(Debug)]
pub struct NewMonolith {
    pub id: MonolithId,
    pub config: MonolithConnectionConfig,
    pub proxy_port: u16,
}
