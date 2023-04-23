#[macro_use]
extern crate rocket;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use rocket_ws as ws;

use crate::balancer::UnauthorizedClient;
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
    let client = UnauthorizedClient {
        id: "TODO".to_string(),
        room: roomName.to_string(),
    };

    ws.channel(move |mut stream| {
        Box::pin(async move {
            let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
            let Ok(Some(Ok(message))) = result else {
                stream.send(ws::Message::Close(Some(ws::frame::CloseFrame {
                    code: ws::frame::CloseCode::Library(4004),
                    reason: "did not send auth token".into(),
                }))).await?;
                return Ok(());
            };

            match message {
                ws::Message::Text(text) => {
                    let message: ClientMessage = serde_json::from_str(&text).unwrap();
                    match message {
                        ClientMessage::Auth(message) => {
                            let client = client.into_client(message.token);
                            println!("TODO: handle client auth");
                            // TODO: give the balancer the client and duplex stream
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
