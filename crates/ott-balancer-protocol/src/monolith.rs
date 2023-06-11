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
        /// The client that sent the message.
        client_id: ClientId,
        /// The message that was received from the client, verbatim.
        payload: Box<RawValue>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum MsgM2B {
    Loaded {
        room: RoomName,
    },
    Unloaded {
        room: RoomName,
    },
    Gossip {
        rooms: Vec<RoomName>,
    },
    RoomMsg {
        /// The room to send the message to.
        room: RoomName,
        /// The client to send the message to. If `None`, send to all clients in the room.
        client_id: Option<ClientId>,
        /// The message to send, verbatim.
        payload: Box<RawValue>,
    },
    Kick {
        client_id: ClientId,
        reason: u16,
    },
}
