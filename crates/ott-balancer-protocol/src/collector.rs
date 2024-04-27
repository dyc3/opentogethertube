use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::{BalancerId, ClientId, MonolithId, Region, RoomName};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct BalancerState {
    pub id: BalancerId,
    pub region: Region,
    pub monoliths: Vec<MonolithState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct MonolithState {
    pub id: MonolithId,
    pub region: Region,
    pub rooms: Vec<RoomState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct RoomState {
    pub name: RoomName,
    pub clients: Vec<ClientState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct ClientState {
    pub id: ClientId,
}

pub enum Event {
    ClientMsg(EClientMsg),
}

pub enum Direction {
    Tx,
    Rx,
}

pub struct EClientMsg {
    pub client_id: ClientId,
    pub direction: Direction,
}
