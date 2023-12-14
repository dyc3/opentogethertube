use std::collections::HashMap;
use std::sync::Arc;

use anyhow::bail;
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
    region: String,
    rooms: HashMap<RoomName, Room>,
    /// The Sender used to send messages to this Monolith.
    monolith_outbound_tx: Arc<tokio::sync::mpsc::Sender<SocketMessage>>,
    /// The Sender to be used by clients to send messages to this Monolith.
    client_inbound_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,
    config: MonolithConnectionConfig,
    proxy_port: u16,
    http_client: reqwest::Client,
}

impl BalancerMonolith {
    pub fn new(
        m: NewMonolith,
        monolith_outbound_tx: Arc<tokio::sync::mpsc::Sender<SocketMessage>>,
        client_inbound_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,
    ) -> Self {
        Self {
            id: m.id,
            region: m.region,
            rooms: HashMap::new(),
            monolith_outbound_tx,
            client_inbound_tx,
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

    pub fn region(&self) -> &str {
        &self.region
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

    pub fn add_room(&mut self, room_name: &RoomName) -> anyhow::Result<&mut Room> {
        if self.rooms.contains_key(&room_name) {
            error!("Monolith already has room {}", room_name);
            bail!("Monolith already has room {}", room_name);
        }
        let room = Room::new(room_name.clone());
        self.rooms.insert(room.name.clone(), room);
        Ok(self.rooms.get_mut(&room_name).unwrap())
    }

    pub fn remove_room(&mut self, room: &RoomName) -> Option<Room> {
        self.rooms.remove(room)
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
        self.monolith_outbound_tx.send(socket_msg).await?;

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

    pub fn add_or_sync_room(&mut self, metadata: RoomMetadata) -> anyhow::Result<()> {
        if self.has_room(&metadata.name) {
            self.set_room_metadata(metadata);
        } else {
            let room = self.add_room(&metadata.name)?;
            room.set_metadata(metadata);
        }

        Ok(())
    }

    pub fn new_inbound_tx(&self) -> tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>> {
        self.client_inbound_tx.clone()
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

    /// The Sender used to broadcast to all clients in this room.
    broadcast_tx: tokio::sync::broadcast::Sender<SocketMessage>,
    /// The Receiver to be used by clients to receive messages from this room.
    broadcast_rx: tokio::sync::broadcast::Receiver<SocketMessage>,
}

impl Room {
    pub fn new(name: RoomName) -> Self {
        let (broadcast_tx, broadcast_rx) = tokio::sync::broadcast::channel(100);
        Self {
            name,
            clients: Vec::new(),
            metadata: None,
            broadcast_tx,
            broadcast_rx,
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

    /// Sender for sending messages to all clients in this room.
    pub fn broadcast_tx(&self) -> &tokio::sync::broadcast::Sender<SocketMessage> {
        &self.broadcast_tx
    }

    /// Create a new Receiver. Used for all clients receiving messages from this room.
    pub fn new_broadcast_rx(&self) -> tokio::sync::broadcast::Receiver<SocketMessage> {
        self.broadcast_tx.subscribe()
    }

    /// Broadcast a message to all clients in this room.
    pub fn broadcast(&self, msg: impl Into<SocketMessage>) -> anyhow::Result<()> {
        self.broadcast_tx.send(msg.into())?;
        Ok(())
    }
}

#[derive(Debug)]
pub struct NewMonolith {
    pub id: MonolithId,
    pub region: String,
    pub config: MonolithConnectionConfig,
    pub proxy_port: u16,
}
