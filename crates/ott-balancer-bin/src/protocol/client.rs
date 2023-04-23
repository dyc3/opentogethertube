//! Defines the communication protocol between the clients and the balancer.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
pub enum ClientMessage {
    Auth(ClientMessageAuth),
    Other(ClientMessageOther),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientMessageAuth {
    action: String,
    token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientMessageOther {
    action: String,
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}
