use std::time::Duration;

use futures_util::StreamExt;
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
}

impl BalancerClient {
    pub fn new(new_client: NewClient) -> Self {
        Self {
            id: new_client.id,
            room: new_client.room,
            token: new_client.token,
        }
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

            match message {
                ws::Message::Text(text) => {
                    let message: ClientMessage = serde_json::from_str(&text).unwrap();
                    match message {
                        ClientMessage::Auth(message) => {
                            println!("client authenticated, handing off to balancer");
                            let client = client.into_new_client(message.token);
                            balancer.send_client(client).await;
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

            while let Some(Ok(message)) = stream.next().await {
                match message {
                    ws::Message::Text(_) => {
                        balancer
                            .send_client_message(client_id, SocketMessage::Message(message))
                            .await;
                    }
                    ws::Message::Close(_) => {
                        balancer
                            .send_client_message(client_id, SocketMessage::Close)
                            .await;
                        break;
                    }
                    _ => {
                        println!("unhandled client message: {:?}", message)
                    }
                }
            }

            Ok(())
        })
    })
}
