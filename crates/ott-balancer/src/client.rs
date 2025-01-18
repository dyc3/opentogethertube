use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use prometheus::{register_int_counter_vec, IntCounterVec};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::sync::broadcast::error::{RecvError, TryRecvError};
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;
use tracing::{debug, error, info, trace, warn};
use uuid::Uuid;

use crate::messages::*;
use crate::{balancer::BalancerLink, connection::BALANCER_ID};
use ott_balancer_protocol::{client::*, *};
use ott_common::websocket::HyperWebsocket;

pub struct UnauthorizedClient {
    pub id: ClientId,
    pub room: RoomName,
    pub edge_region: Region,
}

impl UnauthorizedClient {
    pub fn into_new_client(self, token: String) -> NewClient {
        NewClient {
            id: self.id,
            room: self.room,
            edge_region: self.edge_region,
            token,
        }
    }
}

/// Represents a client websocket connection's context. Used by [`crate::Balancer`] to make a [`BalancerClient`].
#[derive(Debug, Clone)]
pub struct NewClient {
    pub id: ClientId,
    pub room: RoomName,
    pub edge_region: Region,
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
            _ = self.room_tx.closed() => {
                return Err(RecvError::Closed);
            }
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

    pub fn outbound_try_recv(&mut self) -> Result<SocketMessage, TryRecvError> {
        if self.room_tx.is_closed() {
            return Err(TryRecvError::Closed);
        }

        match self.unicast_rx.try_recv() {
            Ok(msg) => return Ok(msg),
            Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                return Err(TryRecvError::Closed)
            }
            Err(_) => {}
        }

        self.broadcast_rx.try_recv()
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
    pub edge_region: Region,
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
            edge_region: new_client.edge_region,
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
    edge_region: Region,
) -> anyhow::Result<()> {
    trace!("websocket connection received");
    let mut stream = ws.await?;

    let client_id = Uuid::new_v4().into();
    let client = UnauthorizedClient {
        id: client_id,
        room: room_name.clone(),
        edge_region,
    };
    tracing::Span::current()
        .record("client_id", client_id.to_string())
        .record("edge_region", client.edge_region.to_string());
    info!("client connected");

    let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
    let Ok(Some(Ok(message))) = result else {
        close(
            &mut stream,
            CloseFrame {
                code: CloseCode::Library(4004),
                reason: "did not send auth token".into(),
            },
        )
        .await?;
        return Ok(());
    };

    let mut client_link;
    match message {
        Message::Text(text) => {
            let jd = &mut serde_json::Deserializer::from_str(&text);
            let message: ClientMessage = match serde_path_to_error::deserialize(jd) {
                Ok(msg) => msg,
                Err(err) => {
                    warn!("failed to deserialize client message: {:?}", err);
                    close(
                        &mut stream,
                        CloseFrame {
                            code: CloseCode::Protocol,
                            reason: "failed to deserialize message".into(),
                        },
                    )
                    .await?;
                    return Ok(());
                }
            };

            match message {
                ClientMessage::Auth(message) => {
                    debug!("client authenticated, handing off to balancer");
                    let client = client.into_new_client(message.token);
                    let Ok(rx) = balancer.send_client(client).await else {
                        error!("failed to send client to balancer");
                        close(
                            &mut stream,
                            CloseFrame {
                                code: CloseCode::Library(4000),
                                reason: "failed to send client to balancer".into(),
                            },
                        )
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

    let mut already_sent_close = false;
    loop {
        tokio::select! {
            msg = client_link.outbound_recv() => {
                match msg {
                    Ok(SocketMessage::Message(msg)) => {
                        debug!(event = "ws", balancer_id = %*BALANCER_ID,  node_id = %client_id, room = %room_name, direction = "tx");

                        let mut close_code = None;
                        if let Message::Close(Some(frame)) = &msg {
                            close_code = Some(frame.code);
                        }
                        if let Err(err) = stream.send(msg).await {
                            error!("Error sending ws message to client: {:?}", err);
                            break;
                        }
                        if let Some(frame) = close_code {
                            already_sent_close = true;
                            COUNTER_WS_CLOSE_CODES
                                .with_label_values(&[&frame.to_string()])
                                .inc();
                            break;
                        }
                    }
                    Err(RecvError::Closed) => {
                        debug!("Client outbound stream ended");
                        break;
                    }
                    Err(RecvError::Lagged(_)) => {
                        error!("Client outbound stream lagged");
                        break;
                    }
                    _ => {
                        break;
                    }
                }
            }

            Some(msg) = stream.next() => {
                if let Ok(msg) = msg {
                    if let Message::Ping(ping) = msg {
                        if let Err(err) = stream.send(Message::Pong(ping)).await {
                            error!("Error sending pong to client: {:?}", err);
                            break;
                        }
                        continue;
                    }

                    debug!(event = "ws", balancer_id = %*BALANCER_ID,  node_id = %client_id, room = %room_name, direction = "rx");
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

    // Drain any remaining messages from the client link, because it might include a Close message.
    while let Ok(SocketMessage::Message(msg)) = client_link.outbound_try_recv() {
        let mut close_code = None;
        if let Message::Close(Some(frame)) = &msg {
            close_code = Some(frame.code);
        }
        if let Err(err) = stream.send(msg).await {
            error!("Error sending ws message to client: {:?}", err);
            break;
        }
        if let Some(frame) = close_code {
            already_sent_close = true;
            COUNTER_WS_CLOSE_CODES
                .with_label_values(&[&frame.to_string()])
                .inc();
            break;
        }
    }

    info!("ending client connection");
    if !already_sent_close && !client_link.room_tx.is_closed() {
        client_link
            .room_tx
            .send(Context::new(
                client_id,
                SocketMessage::Message(Message::Close(Some(CloseFrame {
                    code: CloseCode::Normal,
                    reason: "client connection ended".into(),
                }))),
            ))
            .await?;
    }

    if !already_sent_close {
        close(
            &mut stream,
            CloseFrame {
                code: CloseCode::Normal,
                reason: "client connection ended".into(),
            },
        )
        .await?;
    }

    Ok(())
}

async fn close<S>(stream: &mut WebSocketStream<S>, frame: CloseFrame<'static>) -> anyhow::Result<()>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let code = frame.code;
    stream.send(Message::Close(Some(frame))).await?;
    COUNTER_WS_CLOSE_CODES
        .with_label_values(&[&code.to_string()])
        .inc();
    Ok(())
}

static COUNTER_WS_CLOSE_CODES: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "balancer_client_websocket_close_codes",
        "Count of client websocket close codes",
        &["code"]
    )
    .unwrap()
});
