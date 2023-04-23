#[macro_use]
extern crate rocket;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use rocket_ws as ws;
use uuid::Uuid;

use crate::balancer::{OttBalancer, UnauthorizedClient};
use crate::protocol::client::ClientMessage;

mod balancer;
mod protocol;

#[get("/monolith")]
fn monolith_entry(ws: ws::WebSocket) -> ws::Stream!['static] {
    ws::Stream! { ws =>
        for await message in ws {
            yield message?;
        }
    }
}

#[get("/api/room/<roomName>")]
fn client_entry(roomName: &str, ws: ws::WebSocket) -> ws::Channel<'static> {
    println!("client connected, room: {}", roomName);
    let client = UnauthorizedClient {
        id: Uuid::new_v4(),
        room: roomName.to_string(),
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
                            let client = client.into_client(message.token);
                            // TODO: create a thread safe OttBalancer singleton instance
                            OttBalancer::new().handle_client(client, stream);
                        }
                        ClientMessage::Other => {
                            todo!("handle client message");
                        }
                    }
                }
                _ => {}
            }

            Ok(())
        })
    })
}

#[launch]
fn launch() -> _ {
    rocket::build().mount("/", routes![monolith_entry, client_entry])
}
