use std::sync::Arc;

use collector::{Collector, CURRENT_STATE};
use ott_balancer_protocol::collector::{BalancerState, MonolithState, RoomState};
use ott_common::discovery::{start_discovery_task, DnsDiscoveryConfig, DnsMonolithDiscoverer};
use rocket::serde::json::Json;
use rocket::{serde::json::Json, State};
use serde::Serialize;
use tokio::sync::Mutex;

#[macro_use]
extern crate rocket;

mod collector;
mod cors;

#[derive(Debug, Clone, Serialize)]
pub struct SystemState(Vec<BalancerState>);

fn return_sample_state() -> SystemState {
    SystemState({
        vec![
            BalancerState {
                id: uuid::uuid!("154d9d41-128c-45ab-83d8-28661882c9e3").into(),
                region: "ewr".to_string(),
                monoliths: vec![
                    MonolithState {
                        id: uuid::uuid!("2bd5e4a7-14f6-4da4-bedd-72946864a7bf").into(),
                        region: "ewr".to_string(),
                        rooms: vec![
                            RoomState {
                                name: "foo".into(),
                                clients: 2,
                            },
                            RoomState {
                                name: "bar".into(),
                                clients: 0,
                            },
                        ],
                    },
                    MonolithState {
                        id: uuid::uuid!("419580cb-f576-4314-8162-45340c94bae1").into(),
                        region: "ewr".to_string(),
                        rooms: vec![RoomState {
                            name: "baz".into(),
                            clients: 3,
                        }],
                    },
                    MonolithState {
                        id: uuid::uuid!("0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac").into(),
                        region: "cdg".to_string(),
                        rooms: vec![RoomState {
                            name: "qux".into(),
                            clients: 0,
                        }],
                    },
                ],
            },
            BalancerState {
                id: uuid::uuid!("c91d183c-980e-4160-b196-43658148f469").into(),
                region: "ewr".to_string(),
                monoliths: vec![
                    MonolithState {
                        id: uuid::uuid!("2bd5e4a7-14f6-4da4-bedd-72946864a7bf").into(),
                        region: "ewr".to_string(),
                        rooms: vec![
                            RoomState {
                                name: "foo".into(),
                                clients: 1,
                            },
                            RoomState {
                                name: "bar".into(),
                                clients: 2,
                            },
                        ],
                    },
                    MonolithState {
                        id: uuid::uuid!("419580cb-f576-4314-8162-45340c94bae1").into(),
                        region: "ewr".to_string(),
                        rooms: vec![RoomState {
                            name: "baz".into(),
                            clients: 0,
                        }],
                    },
                    MonolithState {
                        id: uuid::uuid!("0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac").into(),
                        region: "cdg".to_string(),
                        rooms: vec![RoomState {
                            name: "qux".into(),
                            clients: 0,
                        }],
                    },
                ],
            },
            BalancerState {
                id: uuid::uuid!("5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0").into(),
                region: "cdg".to_string(),
                monoliths: vec![
                    MonolithState {
                        id: uuid::uuid!("2bd5e4a7-14f6-4da4-bedd-72946864a7bf").into(),
                        region: "ewr".to_string(),
                        rooms: vec![
                            RoomState {
                                name: "foo".into(),
                                clients: 0,
                            },
                            RoomState {
                                name: "bar".into(),
                                clients: 0,
                            },
                        ],
                    },
                    MonolithState {
                        id: uuid::uuid!("419580cb-f576-4314-8162-45340c94bae1").into(),
                        region: "ewr".to_string(),
                        rooms: vec![RoomState {
                            name: "baz".into(),
                            clients: 0,
                        }],
                    },
                    MonolithState {
                        id: uuid::uuid!("0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac").into(),
                        region: "cdg".to_string(),
                        rooms: vec![RoomState {
                            name: "qux".into(),
                            clients: 4,
                        }],
                    },
                ],
            },
        ]
    })
}

/// Serve the current system state
#[get("/state")]
async fn serve_state(state: &State<Arc<Mutex<SystemState>>>) -> Json<SystemState> {
    let s = state.lock().await.clone();
    Json(s)
}

#[rocket::main]
async fn main() -> anyhow::Result<()> {
    let (discovery_tx, _discovery_rx) = tokio::sync::mpsc::channel(2);
    let discovery = DnsMonolithDiscoverer::new(DnsDiscoveryConfig {
        monolith_port: 8081,
        dns_server: None,
        query: "balancer".to_string(),
    });
    start_discovery_task(discovery, discovery_tx);

    let _collector_handle =
        Collector::new(discovery_rx, tokio::time::Duration::from_secs(5)).spawn();

    rocket::build()
        .attach(cors::Cors)
        .mount("/", routes![status, cors::handle_preflight, serve_state])
        .manage(CURRENT_STATE.clone())
        .launch()
        .await?;

    Ok(())
}

#[get("/status")]
fn status() -> &'static str {
    "OK"
}

#[cfg(test)]
mod test {}
