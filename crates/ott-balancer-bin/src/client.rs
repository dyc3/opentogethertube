use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use rocket::State;
use rocket_ws as ws;
use uuid::Uuid;

use crate::balancer::BalancerLink;
use crate::messages::*;
use ott_balancer_protocol::{client::*, *};

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

    pub async fn send(&self, msg: SocketMessage) -> anyhow::Result<()> {
        self.socket_tx.send(msg).await?;

        Ok(())
    }
}

#[get("/api/room/<room_name>")]
pub fn client_entry<'r>(
    room_name: &str,
    ws: ws::WebSocket,
    balancer: &'r State<BalancerLink>,
) -> ws::Channel<'r> {
    println!("client connected, room: {}", room_name);
    let client_id = Uuid::new_v4().into();
    let client = UnauthorizedClient {
        id: client_id,
        room: room_name.to_string().into(),
    };

    ws.channel(move |mut stream| {
        Box::pin(async move {
            let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
            let Ok(Some(Ok(message))) = result else {
                stream.close(Some(ws::frame::CloseFrame {
                    code: ws::frame::CloseCode::Library(4004),
                    reason: "did not send auth token".into(),
                })).await?;
                return Ok(());
            };

            let mut outbound_rx;
            match message {
                ws::Message::Text(text) => {
                    let message: ClientMessage = serde_json::from_str(&text).unwrap();
                    match message {
                        ClientMessage::Auth(message) => {
                            println!("client authenticated, handing off to balancer");
                            let client = client.into_new_client(message.token);
                            let Ok(rx) = balancer.send_client(client).await else {
                                stream.close(Some(ws::frame::CloseFrame {
                                    code: ws::frame::CloseCode::Library(4000),
                                    reason: "failed to send client to balancer".into(),
                                })).await?;
                                return Ok(());
                            };
                            outbound_rx = rx;
                        }
                        _ => {
                            stream
                                .close(Some(ws::frame::CloseFrame {
                                    code: ws::frame::CloseCode::Library(4004),
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
                        if let Some(msg) = msg {
                            stream.send(msg.0).await;
                        } else {
                            break;
                        }
                    }
                    Some(Ok(message)) = stream.next() => {
                        match message {
                            ws::Message::Text(_) => {
                                balancer
                                    .send_client_message(client_id, SocketMessage(message))
                                    .await;
                            }
                            ws::Message::Close(_) => {
                                println!("client socket closed: {}", client_id);
                                break;
                            }
                            _ => {
                                println!("unhandled client message: {:?}", message)
                            }
                        }
                    }
                }
            }

            Ok(())
        })
    })
}
