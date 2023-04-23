#[macro_use]
extern crate rocket;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use rocket::State;
use rocket_ws as ws;
use tokio::sync::Mutex;
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

#[get("/api/room/<room_name>")]
fn client_entry<'r>(
    room_name: &str,
    ws: ws::WebSocket,
    balancer: &'r State<Arc<Mutex<OttBalancer>>>,
) -> ws::Channel<'r> {
    println!("client connected, room: {}", room_name);
    let client = UnauthorizedClient {
        id: Uuid::new_v4(),
        room: room_name.to_string(),
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
                            balancer.lock().await.handle_client(client, stream);
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
    rocket::build()
        .manage(Arc::new(Mutex::new(OttBalancer::new())))
        .mount("/", routes![monolith_entry, client_entry])
}
