use rocket_ws as ws;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ClientId(Uuid);
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct RoomName(String);
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
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

pub enum SocketMessage {
    Message(ws::Message),
    Close,
}
