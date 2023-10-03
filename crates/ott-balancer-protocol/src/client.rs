//! Defines the communication protocol between the clients and the balancer.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
pub enum ClientMessage {
    Auth(ClientMessageAuth),
    #[serde(other)]
    Other,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientMessageAuth {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientMessageOther {
    pub action: String,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}
