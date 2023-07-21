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
    Init(M2BInit),
    Loaded {
        name: RoomName,
        #[serde(flatten)]
        metadata: RoomMetadata,
    },
    Unloaded {
        room: RoomName,
    },
    Gossip {
        rooms: Vec<GossipRoom>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct M2BInit {
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GossipRoom {
    pub name: RoomName,
    #[serde(flatten)]
    pub metadata: RoomMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Metadata about a room, according to the Monolith.
pub struct RoomMetadata {
    pub title: String,
    pub description: String,
    #[serde(rename = "isTemporary")]
    pub is_temporary: bool,
    pub visibility: Visibility,
    #[serde(rename = "queueMode")]
    pub queue_mode: String,
    #[serde(rename = "currentSource")]
    pub current_source: serde_json::Value,
    /// The number of clients in this room.
    pub users: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
    Public,
    Unlisted,
    Private,
}
