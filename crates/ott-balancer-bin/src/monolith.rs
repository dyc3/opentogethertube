use std::collections::HashMap;

use futures_util::StreamExt;
use rocket::State;
use rocket_ws as ws;
use uuid::Uuid;

use crate::{balancer::BalancerLink, messages::*};

#[derive(Debug)]
pub struct BalancerMonolith {
    id: MonolithId,
    rooms: HashMap<RoomName, Room>,
}

impl BalancerMonolith {
    pub fn new(m: NewMonolith) -> Self {
        Self {
            id: m.id,
            rooms: HashMap::new(),
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
}

#[derive(Debug)]
pub struct Room {
    name: RoomName,
    clients: Vec<ClientId>,
}

impl Room {
    pub fn new(name: RoomName) -> Self {
        Self {
            name,
            clients: Vec::new(),
        }
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
pub fn monolith_entry<'r>(ws: ws::WebSocket, balancer: &'r State<BalancerLink>) -> ws::Channel<'r> {
    ws.channel(move |mut stream| {
        Box::pin(async move {
            // TODO: maybe wait for first gossip?

            let monolith_id = Uuid::new_v4().into();
            let monolith = NewMonolith { id: monolith_id };

            balancer.send_monolith(monolith).await;

            while let Some(Ok(message)) = stream.next().await {
                match message {
                    ws::Message::Text(_) => {
                        balancer
                            .send_monolith_message(monolith_id, SocketMessage::Message(message))
                            .await;
                    }
                    ws::Message::Close(_) => {
                        balancer
                            .send_monolith_message(monolith_id, SocketMessage::Close)
                            .await;
                    }
                    _ => {
                        println!("unhandled monolith message: {:?}", message);
                    }
                }
            }

            Ok(())
        })
    })
}
