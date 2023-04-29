use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum Request {
    Load {
        room: String,
    },
    Join {
        room: String,
        client: Uuid,
        token: String,
    },
    Leave {
        client: Uuid,
    },
    ClientMsg {
        client_id: Uuid,
        payload: Box<RawValue>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Outbound {
    Loaded {
        room: String,
    },
    Unloaded {
        room: String,
    },
    Gossip {
        rooms: Vec<String>,
    },
    RoomMsg {
        room: String,
        client_id: Option<Uuid>,
        payload: Box<RawValue>,
    },
}
