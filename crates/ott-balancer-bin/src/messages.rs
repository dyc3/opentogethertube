use rocket_ws as ws;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct ClientId(Uuid);
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct RoomName(String);
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct MonolithId(Uuid);

impl Into<Uuid> for ClientId {
    fn into(self) -> Uuid {
        self.0
    }
}

impl Into<ClientId> for Uuid {
    fn into(self) -> ClientId {
        ClientId(self)
    }
}

impl Into<String> for RoomName {
    fn into(self) -> String {
        self.0
    }
}

impl Into<RoomName> for String {
    fn into(self) -> RoomName {
        RoomName(self)
    }
}

impl Into<Uuid> for MonolithId {
    fn into(self) -> Uuid {
        self.0
    }
}

impl Into<MonolithId> for Uuid {
    fn into(self) -> MonolithId {
        MonolithId(self)
    }
}

#[derive(Debug, Clone)]
pub struct Context<Id, T>
where
    Id: std::hash::Hash,
{
    id: Id,
    message: T,
}

impl<Id, T> Context<Id, T>
where
    Id: std::hash::Hash,
{
    pub fn new(id: Id, message: T) -> Self {
        Self { id, message }
    }
}

#[derive(Debug)]
pub enum SocketMessage {
    Message(ws::Message),
    Close,
}
