use std::collections::HashMap;

pub struct OttMonolith {
    pub rooms: Vec<String>,
    pub load: f64,
}

pub struct UnauthorizedClient {
    pub id: String,
    pub room: String,
}

impl UnauthorizedClient {
    pub fn into_client(self, token: String) -> Client {
        Client {
            id: self.id,
            room: self.room,
            token,
        }
    }
}

pub struct Client {
    pub id: String,
    pub room: String,
    pub token: String,
}

pub struct OttBalancer {
    pub monoliths: Vec<OttMonolith>,
    pub clients: Vec<Client>,
}

impl OttBalancer {
    pub fn new() -> Self {
        Self {
            monoliths: Vec::new(),
            clients: Vec::new(),
        }
    }

    pub fn process_gossip(&mut self) {
        todo!("implement gossip processing");
    }

    pub fn find_monolith(&self, room: &str) -> Option<&OttMonolith> {
        // TODO: implement a more efficient data structure
        self.monoliths
            .iter()
            .find(|m| m.rooms.contains(&room.to_string()))
    }
}
