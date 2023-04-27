//! Defines the communication protocol between the monoliths and the balancer.

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;

use crate::{ClientId, RoomName};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum MsgB2M {
    Load {
        room: RoomName,
    },
    Join {
        room: RoomName,
        client: ClientId,
        token: String,
    },
    Leave {
        client: ClientId,
    },
    ClientMsg {
        client_id: ClientId,
        payload: Box<RawValue>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum MsgM2B {
    Loaded { room: RoomName },
    Unloaded { room: RoomName },
    Gossip { rooms: Vec<RoomName> },
}
