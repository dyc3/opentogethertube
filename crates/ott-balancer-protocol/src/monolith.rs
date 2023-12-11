//! Defines the communication protocol between the monoliths and the balancer.

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use typeshare::typeshare;

use crate::{ClientId, RoomName};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
#[typeshare]
pub enum MsgB2M {
    Load(B2MLoad),
    Unload(B2MUnload),
    Join(B2MJoin),
    Leave(B2MLeave),
    ClientMsg(B2MClientMsg),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct B2MLoad {
    pub room: RoomName,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct B2MUnload {
    pub room: RoomName,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct B2MJoin {
    pub room: RoomName,
    pub client: ClientId,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct B2MLeave {
    pub client: ClientId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct B2MClientMsg<T = Box<RawValue>> {
    /// The client that sent the message.
    pub client_id: ClientId,
    /// The message that was received from the client, verbatim.
    pub payload: T,
}

impl From<B2MLoad> for MsgB2M {
    fn from(val: B2MLoad) -> Self {
        Self::Load(val)
    }
}

impl From<B2MUnload> for MsgB2M {
    fn from(val: B2MUnload) -> Self {
        Self::Unload(val)
    }
}

impl From<B2MJoin> for MsgB2M {
    fn from(val: B2MJoin) -> Self {
        Self::Join(val)
    }
}

impl From<B2MLeave> for MsgB2M {
    fn from(val: B2MLeave) -> Self {
        Self::Leave(val)
    }
}

impl From<B2MClientMsg> for MsgB2M {
    fn from(val: B2MClientMsg) -> Self {
        Self::ClientMsg(val)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
#[typeshare]
pub enum MsgM2B<T = Box<RawValue>> {
    Init(M2BInit),
    Loaded(M2BLoaded),
    Unloaded(M2BUnloaded),
    Gossip(M2BGossip),
    RoomMsg(M2BRoomMsg<T>),
    Kick(M2BKick),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct M2BInit {
    /// The port that the monolith is listening for HTTP requests on.
    pub port: u16,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct M2BLoaded {
    pub room: RoomMetadata,
    /// A system-global epoch that is incremented every time a room is loaded or unloaded on any monolith. Used to determine which instance of a room is the oldest.
    pub load_epoch: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct M2BUnloaded {
    pub name: RoomName,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct M2BGossip {
    pub rooms: Vec<GossipRoom>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct GossipRoom {
    pub room: RoomMetadata,
    pub load_epoch: u32,
}

/// Wrapper around a message that should be sent to clients in a room. The payload is any value that can be serialized to JSON.
///
/// ```rust
/// # use serde_json::value::RawValue;
/// # use ott_balancer_protocol::monolith::{MsgM2B, M2BRoomMsg};
/// let json = M2BRoomMsg {
///   room: "foo".into(),
///   client_id: None,
///   payload: serde_json::json!({}),
/// };
///
/// let raw = M2BRoomMsg {
///   room: "foo".into(),
///   client_id: None,
///   payload: RawValue::from_string("{}".to_owned()).unwrap(),
/// };
///
/// let msg = MsgM2B::from(json);
/// let msg = MsgM2B::from(raw);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct M2BRoomMsg<T = Box<RawValue>> {
    /// The room to send the message to.
    pub room: RoomName,
    /// The client to send the message to. If `None`, send to all clients in the room.
    pub client_id: Option<ClientId>,
    /// The message to send, verbatim.
    pub payload: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct M2BKick {
    pub client_id: ClientId,
    pub reason: u16,
}

impl From<M2BInit> for MsgM2B {
    fn from(val: M2BInit) -> Self {
        Self::Init(val)
    }
}

impl From<M2BLoaded> for MsgM2B {
    fn from(val: M2BLoaded) -> Self {
        Self::Loaded(val)
    }
}

impl From<M2BUnloaded> for MsgM2B {
    fn from(val: M2BUnloaded) -> Self {
        Self::Unloaded(val)
    }
}

impl From<M2BGossip> for MsgM2B {
    fn from(val: M2BGossip) -> Self {
        Self::Gossip(val)
    }
}

impl<T> From<M2BRoomMsg<T>> for MsgM2B<T>
where
    T: Serialize,
{
    fn from(val: M2BRoomMsg<T>) -> Self {
        Self::RoomMsg(val)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[typeshare]
/// Metadata about a room, according to the Monolith.
pub struct RoomMetadata {
    pub name: RoomName,
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
    pub users: u32,
}

impl RoomMetadata {
    pub fn default_with_name(name: impl Into<RoomName>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[typeshare]
pub enum Visibility {
    Public,
    #[default]
    Unlisted,
    Private,
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn m2b_room_msg_serializability() {
        // M2BRoomMsg should be able to accept any type that can be serialized to JSON, and it should be usable in the MsgM2B enum.

        let raw = M2BRoomMsg {
            room: "foo".into(),
            client_id: None,
            payload: RawValue::from_string("{}".to_owned()).unwrap(),
        };

        let json = M2BRoomMsg {
            room: "foo".into(),
            client_id: None,
            payload: serde_json::json!({}),
        };

        let raw_ser = serde_json::to_string(&MsgM2B::from(raw)).unwrap();
        let json_ser = serde_json::to_string(&MsgM2B::from(json)).unwrap();
        assert_eq!(raw_ser, json_ser);
    }
}
