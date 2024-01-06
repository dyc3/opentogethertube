use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast::error::RecvError;
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, trace};
use uuid::Uuid;

use crate::balancer::BalancerLink;
use crate::messages::*;
use ott_balancer_protocol::{client::*, *};
use ott_common::websocket::HyperWebsocket;

pub struct UnauthorizedClient {
    pub id: ClientId,
    pub room: RoomName,
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

/// Represents a client websocket connection's context. Used by [`crate::Balancer`] to make a [`BalancerClient`].
#[derive(Debug, Clone)]
pub struct NewClient {
    pub id: ClientId,
    pub room: RoomName,
    pub token: String,
}

#[derive(Debug)]
pub struct ClientLink {
    id: ClientId,
    /// Messages to send to the Room this client is in.
    room_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,
    /// Messages sent by the Balancer that need to be sent to all clients in the same room as this client.
    broadcast_rx: tokio::sync::broadcast::Receiver<SocketMessage>,
    /// Messages sent by the Balancer that need to be sent to this client.
    unicast_rx: tokio::sync::mpsc::Receiver<SocketMessage>,
}

impl ClientLink {
    pub fn new(
        id: ClientId,
        room_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,
        broadcast_rx: tokio::sync::broadcast::Receiver<SocketMessage>,
        unicast_rx: tokio::sync::mpsc::Receiver<SocketMessage>,
    ) -> Self {
        Self {
            id,
            room_tx,
            broadcast_rx,
            unicast_rx,
        }
    }

    /// Receive the next message from the Balancer that needs to be sent to this client.
    pub async fn outbound_recv(&mut self) -> Result<SocketMessage, RecvError> {
        let msg = tokio::select! {
            msg = self.unicast_rx.recv() => {
                match msg {
                    Some(msg) => Ok(msg),
                    None => return Err(RecvError::Closed),
                }
            }
            msg = self.broadcast_rx.recv() => {
                msg
            }
        }?;

        Ok(msg)
    }

    /// Send a message to the Room this client is in via the Balancer
    pub async fn inbound_send(&mut self, msg: impl Into<SocketMessage>) -> anyhow::Result<()> {
        self.room_tx.send(Context::new(self.id, msg.into())).await?;

        Ok(())
    }
}

#[derive(Debug)]
pub struct BalancerClient {
    pub id: ClientId,
    pub room: RoomName,
    pub token: String,
    /// The Sender used to send outbound messages to this client.
    unicast_tx: tokio::sync::mpsc::Sender<SocketMessage>,
}

impl BalancerClient {
    pub fn new(
        new_client: NewClient,
        unicast_tx: tokio::sync::mpsc::Sender<SocketMessage>,
    ) -> Self {
        Self {
            id: new_client.id,
            room: new_client.room,
            token: new_client.token,
            unicast_tx,
        }
    }

    pub async fn send(&self, msg: impl Into<SocketMessage>) -> anyhow::Result<()> {
        self.unicast_tx.send(msg.into()).await?;

        Ok(())
    }
}

#[tracing::instrument(skip(balancer, ws), fields(client_id))]
pub async fn client_entry<'r>(
    room_name: RoomName,
    ws: HyperWebsocket,
    balancer: BalancerLink,
) -> anyhow::Result<()> {
    trace!("websocket connection received");
    let mut stream = ws.await?;

    let client_id = Uuid::new_v4().into();
    let client = UnauthorizedClient {
        id: client_id,
        room: room_name,
    };
    tracing::Span::current().record("client_id", client_id.to_string());
    info!("client connected");

    let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
    let Ok(Some(Ok(message))) = result else {
        stream
            .close(Some(CloseFrame {
                code: CloseCode::Library(4004),
                reason: "did not send auth token".into(),
            }))
            .await?;
        return Ok(());
    };

    let mut client_link;
    match message {
        Message::Text(text) => {
            let message: ClientMessage = serde_json::from_str(&text).unwrap();
            match message {
                ClientMessage::Auth(message) => {
                    debug!("client authenticated, handing off to balancer");
                    let client = client.into_new_client(message.token);
                    let Ok(rx) = balancer.send_client(client).await else {
                        error!("failed to send client to balancer");
                        stream
                            .close(Some(CloseFrame {
                                code: CloseCode::Library(4000),
                                reason: "failed to send client to balancer".into(),
                            }))
                            .await?;
                        return Ok(());
                    };
                    client_link = rx;
                }
                _ => {
                    debug!("did not send auth token");
                    stream
                        .close(Some(CloseFrame {
                            code: CloseCode::Library(4004),
                            reason: "did not send auth token".into(),
                        }))
                        .await?;
                    return Ok(());
                }
            }
        }
        _ => {
            return Ok(());
        }
    }

    loop {
        tokio::select! {
            Ok(msg) = client_link.outbound_recv() => {
                if let SocketMessage::Message(msg) = msg {
                    if let Err(err) = stream.send(msg).await {
                        error!("Error sending ws message to client: {:?}", err);
                        break;
                    }
                } else {
                    info!("Client outbound stream ended");
                    break;
                }
            }

            Some(msg) = stream.next() => {
                if let Ok(msg) = msg {
                    if let Err(err) = client_link.inbound_send(msg).await {
                        error!("Error sending client message to balancer: {:?}", err);
                        break;
                    }
                } else {
                    debug!("Client inbound websocket stream ended");
                    break;
                }
            }

            else => {
                debug!("Client websocket stream ended");
                break;
            }
        }
    }

    info!("ending client connection");

    Ok(())
}
