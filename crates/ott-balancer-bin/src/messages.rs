use rocket_ws as ws;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug)]
pub enum SocketMessage {
    Message(ws::Message),
    Close,
}
