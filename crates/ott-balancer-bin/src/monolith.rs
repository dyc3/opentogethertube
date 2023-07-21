use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::{monolith::*, *};
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info};
use tungstenite::protocol::frame::coding::CloseCode;
use tungstenite::protocol::CloseFrame;
use uuid::Uuid;

use crate::websocket::HyperWebsocket;
use crate::{balancer::BalancerLink, messages::*};

/// A Monolith refers to the NodeJS server that manages rooms and performs all business logic.
#[derive(Debug)]
pub struct BalancerMonolith {
    id: MonolithId,
    rooms: HashMap<RoomName, Room>,
    socket_tx: tokio::sync::mpsc::Sender<SocketMessage>,
    address: SocketAddr,
    proxy_address: SocketAddr,
    http_client: reqwest::Client,
}

impl BalancerMonolith {
    pub fn new(m: NewMonolith, socket_tx: tokio::sync::mpsc::Sender<SocketMessage>) -> Self {
        Self {
            id: m.id,
            rooms: HashMap::new(),
            socket_tx,
            address: m.address,
            proxy_address: m.proxy_address,
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

    /// The network address and port from which this Monolith is connected via websocket.
    #[allow(dead_code)]
    pub fn address(&self) -> SocketAddr {
        self.address
    }

    /// The network address that can be used to send HTTP requests to this Monolith.
    pub fn proxy_address(&self) -> SocketAddr {
        self.proxy_address
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

    pub async fn send(&self, msg: &MsgB2M) -> anyhow::Result<()> {
        let text = serde_json::to_string(&msg)?;
        let socket_msg = Message::Text(text).into();
        self.socket_tx.send(socket_msg).await?;

        Ok(())
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
    pub address: SocketAddr,
    pub proxy_address: SocketAddr,
}

pub async fn monolith_entry(
    address: SocketAddr,
    ws: HyperWebsocket,
    balancer: BalancerLink,
) -> anyhow::Result<()> {
    info!("Monolith connected");
    let mut stream = ws.await?;

    let monolith_id = Uuid::new_v4().into();

    let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
    let Ok(Some(Ok(message))) = result else {
                stream.close(Some(CloseFrame {
                    code: CloseCode::Library(4000),
                    reason: "did not send init".into(),
                })).await?;
                return Ok(());
            };

    let mut outbound_rx;
    match message {
        Message::Text(text) => {
            let message: MsgM2B = serde_json::from_str(&text).unwrap();
            match message {
                MsgM2B::Init(init) => {
                    debug!("monolith sent init, handing off to balancer");
                    let mut proxy_address = address;
                    proxy_address.set_port(init.port);
                    let monolith = NewMonolith {
                        id: monolith_id,
                        address,
                        proxy_address,
                    };
                    let Ok(rx) = balancer.send_monolith(monolith).await else {
                        stream.close(Some(CloseFrame {
                                    code: CloseCode::Library(4000),
                                    reason: "failed to send monolith to balancer".into(),
                                })).await?;
                                return Ok(());
                            };
                    info!("Monolith {id} linked to balancer", id = monolith_id);
                    outbound_rx = rx;
                }
                _ => {
                    stream
                        .close(Some(CloseFrame {
                            code: CloseCode::Library(4004),
                            reason: "did not send auth token".into(),
                        }))
                        .await?;
                    return Ok(());
                }
            }
        }
        _ => {
            return Ok(());
        }
    }

    loop {
        tokio::select! {
            msg = outbound_rx.recv() => {
                if let Some(SocketMessage::Message(msg)) = msg {
                    if let Err(err) = stream.send(msg).await {
                        error!("Error sending ws message to monolith: {:?}", err);
                        break;
                    }
                } else {
                    continue;
                }
            }

            msg = stream.next() => {
                if let Some(Ok(msg)) = msg {
                    if let Err(err) = balancer
                        .send_monolith_message(monolith_id, SocketMessage::Message(msg))
                        .await {
                            error!("Error sending monolith message to balancer: {:?}", err);
                            break;
                        }
                } else {
                    info!("Monolith websocket stream ended: {}", monolith_id);
                    #[allow(deprecated)]
                    if let Err(err) = balancer
                        .send_monolith_message(monolith_id, SocketMessage::End)
                        .await {
                            error!("Error sending monolith message to balancer: {:?}", err);
                            break;
                        }
                    break;
                }
            }
        }
    }

    Ok(())
}
