use std::collections::HashMap;

use crate::messages::*;

#[derive(Debug)]
pub struct BalancerMonolith {
    id: MonolithId,
    rooms: HashMap<RoomName, Room>,
}

impl BalancerMonolith {
    pub fn new(id: MonolithId) -> Self {
        Self {
            id,
            rooms: HashMap::new(),
        }
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
