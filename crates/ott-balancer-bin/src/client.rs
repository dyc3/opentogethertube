use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::balancer::B2XSocketMessage;

pub struct OttMonolith {
    pub id: Uuid,
    pub rooms: Vec<String>,
    pub load: f64,

    pub join_handle: tokio::task::JoinHandle<()>,
    // m2b_recv: Receiver<X2BSocketMessage>,
    b2m_send: Sender<B2XSocketMessage>,
}

impl OttMonolith {
    pub fn new(
        id: Uuid,
        join_handle: tokio::task::JoinHandle<()>,

        b2m_send: Sender<B2XSocketMessage>,
    ) -> Self {
        Self {
            id,
            rooms: vec![],
            load: 0.0,

            join_handle,
            b2m_send,
        }
    }
}

pub struct UnauthorizedClient {
    pub id: Uuid,
    pub room: String,
}

impl UnauthorizedClient {
    pub fn into_new_client(self, token: String) -> NewClient {
        NewClient {
            id: self.id,
            room: self.room,
            token,
        }
    }
}

/// Represents a client websocket connection's context. Used by [`OttBalancer`] to make a [`BalancerClient`].
pub struct NewClient {
    pub id: Uuid,
    pub room: String,
    pub token: String,
}

pub(crate) struct BalancerClient {
    pub client: NewClient,
    pub send: tokio::sync::mpsc::Sender<B2XSocketMessage>,
    pub join_handle: tokio::task::JoinHandle<()>,
}
