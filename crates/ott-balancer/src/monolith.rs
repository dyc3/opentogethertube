use std::fmt::Display;
use std::sync::Arc;
use std::{collections::HashMap, time::Duration};

use anyhow::bail;
use once_cell::sync::Lazy;
use ott_balancer_protocol::monolith::*;
use ott_balancer_protocol::*;
use ott_common::discovery::ConnectionConfig;
use prometheus::{register_histogram_vec, register_int_counter_vec, HistogramVec, IntCounterVec};
use thiserror::Error;
use tokio::sync::mpsc::error::SendTimeoutError;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, instrument, warn};

use crate::messages::*;

/// A cloneable handle for sending balancer messages to a monolith without
/// borrowing the full monolith entry from shared balancer state.
#[derive(Clone, Debug)]
pub struct MonolithSendHandle {
    monolith_id: MonolithId,
    monolith_outbound_tx: Arc<tokio::sync::mpsc::Sender<SocketMessage>>,
}

impl MonolithSendHandle {
    pub fn monolith_id(&self) -> MonolithId {
        self.monolith_id
    }

    pub async fn send(&self, msg: impl Into<MsgB2M>) -> Result<(), MonolithSendError> {
        let timer = HISTOGRAM_MONOLITH_SEND_SECONDS
            .with_label_values(&[&self.monolith_id.to_string()])
            .start_timer();
        let text = serde_json::to_string(&msg.into()).map_err(MonolithSendError::SerdeError)?;
        let socket_msg = Message::Text(text).into();
        if self.monolith_outbound_tx.capacity() == 0 {
            COUNTER_MONOLITH_OUTBOUND_FULL
                .with_label_values(&[&self.monolith_id.to_string()])
                .inc();
            warn!(monolith_id = %self.monolith_id, "Monolith outbound tx is full");
        }
        let result = self
            .monolith_outbound_tx
            .send_timeout(socket_msg, Duration::from_secs(1))
            .await
            .map_err(MonolithSendError::SendTimeoutError);
        timer.observe_duration();
        if result.is_err() {
            COUNTER_MONOLITH_SEND_ERRORS
                .with_label_values(&[&self.monolith_id.to_string()])
                .inc();
        }
        result?;

        Ok(())
    }
}

static COUNTER_MONOLITH_OUTBOUND_FULL: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "balancer_monolith_outbound_full_total",
        "Count of times a monolith outbound channel was already full",
        &["monolith_id"]
    )
    .unwrap()
});

static COUNTER_MONOLITH_SEND_ERRORS: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "balancer_monolith_send_errors_total",
        "Count of monolith send errors",
        &["monolith_id"]
    )
    .unwrap()
});

static HISTOGRAM_MONOLITH_SEND_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "balancer_monolith_send_seconds",
        "Monolith send latency in seconds",
        &["monolith_id"]
    )
    .unwrap()
});

/// A cloneable snapshot of the HTTP proxy details for a monolith.
///
/// This lets request handlers choose a target while holding the balancer lock,
/// then drop the lock before doing network I/O.
#[derive(Clone, Debug)]
pub struct MonolithProxyTarget {
    id: MonolithId,
    config: ConnectionConfig,
    proxy_port: u16,
    http_client: reqwest::Client,
}

impl MonolithProxyTarget {
    pub fn id(&self) -> MonolithId {
        self.id
    }

    pub fn config(&self) -> &ConnectionConfig {
        &self.config
    }

    pub fn proxy_port(&self) -> u16 {
        self.proxy_port
    }

    pub fn http_client(&self) -> &reqwest::Client {
        &self.http_client
    }
}

/// A Monolith refers to the NodeJS server that manages rooms and performs all business logic.
#[derive(Debug)]
pub struct BalancerMonolith {
    id: MonolithId,
    region: Region,
    rooms: HashMap<RoomName, Room>,
    /// The Sender used to send messages to this Monolith.
    monolith_outbound_tx: Arc<tokio::sync::mpsc::Sender<SocketMessage>>,
    /// The Sender to be used by clients to send messages to this Monolith.
    client_inbound_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,
    config: ConnectionConfig,
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

    pub fn region(&self) -> &Region {
        &self.region
    }

    pub fn rooms(&self) -> &HashMap<RoomName, Room> {
        &self.rooms
    }

    pub fn config(&self) -> &ConnectionConfig {
        &self.config
    }

    /// The network port that can be used to send proxied HTTP requests to this Monolith.
    pub fn proxy_port(&self) -> u16 {
        self.proxy_port
    }

    pub fn http_client(&self) -> &reqwest::Client {
        &self.http_client
    }

    /// Create a cloneable send handle that can be used after releasing the
    /// balancer context lock.
    pub fn send_handle(&self) -> MonolithSendHandle {
        MonolithSendHandle {
            monolith_id: self.id,
            monolith_outbound_tx: self.monolith_outbound_tx.clone(),
        }
    }

    /// Create a cloneable proxy target snapshot for forwarding HTTP requests
    /// without holding a borrow on this monolith.
    pub fn proxy_target(&self) -> MonolithProxyTarget {
        MonolithProxyTarget {
            id: self.id,
            config: self.config.clone(),
            proxy_port: self.proxy_port,
            http_client: self.http_client.clone(),
        }
    }

    pub fn add_room(&mut self, room_name: &RoomName) -> anyhow::Result<&mut Room> {
        if self.rooms.contains_key(room_name) {
            error!("Monolith already has room {}", room_name);
            bail!("Monolith already has room {}", room_name);
        }
        let room = Room::new(room_name.clone());
        self.rooms.insert(room.name.clone(), room);
        Ok(self.rooms.get_mut(room_name).unwrap())
    }

    #[instrument(skip(self), fields(monolith_id = %self.id), ret)]
    pub fn remove_room(&mut self, room: &RoomName) -> Option<Room> {
        self.rooms.remove(room).inspect(|_| {
            info!("room removed");
        })
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

    pub async fn send(&self, msg: impl Into<MsgB2M>) -> Result<(), MonolithSendError> {
        self.send_handle().send(msg).await
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

#[derive(Debug, Error)]
pub enum MonolithSendError {
    SendTimeoutError(SendTimeoutError<SocketMessage>),
    SerdeError(serde_json::Error),
}

impl Display for MonolithSendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
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
}

impl Room {
    pub fn new(name: RoomName) -> Self {
        let (broadcast_tx, _broadcast_rx) = tokio::sync::broadcast::channel(100);
        Self {
            name,
            clients: Vec::new(),
            metadata: None,
            broadcast_tx,
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

    /// Create a new Receiver. Used for all clients receiving messages from this room.
    pub fn new_broadcast_rx(&self) -> tokio::sync::broadcast::Receiver<SocketMessage> {
        self.broadcast_tx.subscribe()
    }

    /// Broadcast a message to all clients in this room.
    pub fn broadcast(&self, msg: impl Into<SocketMessage>) -> anyhow::Result<()> {
        debug!(event = "broadcast", node_id = %self.name, direction = "tx");
        self.broadcast_tx.send(msg.into())?;
        Ok(())
    }
}

#[derive(Debug)]
pub struct NewMonolith {
    pub id: MonolithId,
    pub region: Region,
    pub config: ConnectionConfig,
    pub proxy_port: u16,
}
