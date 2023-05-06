use std::collections::HashMap;

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::{monolith::*, *};
use rocket::State;
use rocket_ws as ws;
use uuid::Uuid;

use crate::{balancer::BalancerLink, messages::*};

/// A Monolith refers to the NodeJS server that manages rooms and performs all business logic.
#[derive(Debug)]
pub struct BalancerMonolith {
    id: MonolithId,
    rooms: HashMap<RoomName, Room>,
    socket_tx: tokio::sync::mpsc::Sender<SocketMessage>,
}

impl BalancerMonolith {
    pub fn new(m: NewMonolith, socket_tx: tokio::sync::mpsc::Sender<SocketMessage>) -> Self {
        Self {
            id: m.id,
            rooms: HashMap::new(),
            socket_tx,
        }
    }

    pub fn id(&self) -> MonolithId {
        self.id
    }

    pub fn rooms(&self) -> &HashMap<RoomName, Room> {
        &self.rooms
    }

    pub fn add_room(&mut self, room: Room) {
        self.rooms.insert(room.name.clone(), room);
    }

    pub fn remove_room(&mut self, room: RoomName) {
        self.rooms.remove(&room);
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
        let socket_msg = SocketMessage(ws::Message::Text(text));
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
}

impl Room {
    pub fn new(name: RoomName) -> Self {
        Self {
            name,
            clients: Vec::new(),
        }
    }

    pub fn name(&self) -> &RoomName {
        &self.name
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
}

#[get("/monolith")]
pub fn monolith_entry(ws: ws::WebSocket, balancer: &State<BalancerLink>) -> ws::Channel<'_> {
    ws.channel(move |mut stream| {
        Box::pin(async move {
            // TODO: maybe wait for first gossip?

            let monolith_id = Uuid::new_v4().into();
            let monolith = NewMonolith { id: monolith_id };

            let mut receiver = balancer.send_monolith(monolith).await.unwrap();

            loop {
                tokio::select! {
                    msg = receiver.recv() => {
                        if let Some(msg) = msg {
                            stream.send(msg.0).await;
                        } else {
                            break;
                        }
                    }

                    Some(Ok(msg)) = stream.next() => {
                        match msg {
                            ws::Message::Text(_) => {
                                balancer
                                    .send_monolith_message(monolith_id, SocketMessage(msg))
                                    .await;
                            }
                            ws::Message::Close(_) => {
                                println!("monolith socket closed: {}", monolith_id);
                            }
                            _ => {
                                println!("unhandled monolith message: {:?}", msg);
                            }
                        }
                    }
                }
            }

            Ok(())
        })
    })
}
