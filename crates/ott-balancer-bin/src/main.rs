#[macro_use]
extern crate rocket;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use rocket::fairing::{Fairing, Info, Kind};
use rocket::State;
use rocket_ws as ws;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::balancer::OttBalancer;
use crate::client::UnauthorizedClient;
use crate::protocol::client::ClientMessage;

mod balancer;
mod client;
mod protocol;

#[get("/monolith")]
fn monolith_entry<'r>(
    ws: ws::WebSocket,
    balancer: &'r State<Arc<Mutex<OttBalancer>>>,
) -> ws::Channel<'r> {
    ws.channel(move |mut stream| {
        Box::pin(async move {
            // TODO: maybe wait for first gossip?
            balancer.lock().await.handle_monolith(stream);

            Ok(())
        })
    })
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
                            let client = client.into_new_client(message.token);
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

struct BalancerStarter;

#[rocket::async_trait]
impl Fairing for BalancerStarter {
    fn info(&self) -> Info {
        Info {
            name: "Balancer Starter",
            kind: Kind::Liftoff,
        }
    }

    async fn on_liftoff(&self, rocket: &rocket::Rocket<rocket::Orbit>) {
        let balancer = rocket.state::<Arc<Mutex<OttBalancer>>>().unwrap().clone();
        tokio::spawn(async move {
            // FIXME: this is most certainly the worst way to do this
            // 1. this doesn't allow for parallel processing of messages
            // 2. if a message takes longer than 1ms to process, it will be dropped
            loop {
                let mut balancer = balancer.lock().await;
                let _ = tokio::time::timeout(Duration::from_millis(1), balancer.tick()).await;
            }
        });
    }
}

#[launch]
fn launch() -> _ {
    rocket::build()
        .attach(BalancerStarter)
        .manage(Arc::new(Mutex::new(OttBalancer::new())))
        .mount("/", routes![monolith_entry, client_entry])
}
