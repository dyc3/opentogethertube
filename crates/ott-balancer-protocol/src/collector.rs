use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::{BalancerId, ClientId, MonolithId, RoomName};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct BalancerState {
    pub id: BalancerId,
    pub region: String,
    pub monoliths: Vec<MonolithState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct MonolithState {
    pub id: MonolithId,
    pub region: String,
    pub rooms: Vec<RoomState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[typeshare]
pub struct RoomState {
    pub name: RoomName,
    pub clients: u32,
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
