use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
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

/// Represents a client websocket connection's context. Used by [`OttBalancer`] to make a [`BalancerClient`].
#[derive(Debug, Clone)]
pub struct NewClient {
    pub id: ClientId,
    pub room: RoomName,
    pub token: String,
}

#[derive(Debug)]
pub struct BalancerClient {
    pub id: ClientId,
    pub room: RoomName,
    pub token: String,
    socket_tx: tokio::sync::mpsc::Sender<SocketMessage>,
}

impl BalancerClient {
    pub fn new(new_client: NewClient, socket_tx: tokio::sync::mpsc::Sender<SocketMessage>) -> Self {
        Self {
            id: new_client.id,
            room: new_client.room,
            token: new_client.token,
            socket_tx,
        }
    }

    pub async fn send(&self, msg: impl Into<SocketMessage>) -> anyhow::Result<()> {
        self.socket_tx.send(msg.into()).await?;

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

    let mut outbound_rx;
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
                    outbound_rx = rx;
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
            msg = outbound_rx.recv() => {
                if let Some(SocketMessage::Message(msg)) = msg {
                    if let Err(err) = stream.send(msg).await {
                        error!("Error sending ws message to client: {:?}", err);
                        break;
                    }
                } else {
                    continue;
                }
            }

            msg = stream.next() => {
                if let Some(Ok(msg)) = msg {
                    if let Err(err) = balancer
                        .send_client_message(client_id, SocketMessage::Message(msg))
                        .await {
                            error!("Error sending client message to balancer: {:?}", err);
                            break;
                        }
                } else {
                    info!("Client websocket stream ended");
                    // if let Err(err) = balancer
                    //     .send_client_message(client_id, SocketMessage::End)
                    //     .await {
                    //         error!("Error sending client message to balancer: {:?}", err);
                    //         break;
                    //     }
                    break;
                }
            }
        }
    }

    Ok(())
}
