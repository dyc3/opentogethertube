use serde::{Deserialize, Serialize};

use crate::{BalancerId, ClientId, MonolithId, RoomName};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalancerState {
    pub id: BalancerId,
    pub region: String,
    pub monoliths: Vec<MonolithState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonolithState {
    pub id: MonolithId,
    pub region: String,
    pub rooms: Vec<RoomState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomState {
    pub name: RoomName,
    pub clients: usize,
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
