use ott_common::discovery::{start_discovery_task, DnsDiscoveryConfig, DnsMonolithDiscoverer};
use rocket::serde::json::Json;
use serde::Serialize;

#[macro_use]
extern crate rocket;

mod cors;

#[derive(Debug, Clone, Serialize)]
struct SystemState(Vec<Balancer>);

#[derive(Debug, Clone, Serialize)]
struct Balancer {
    id: String,
    region: String,
    monoliths: Vec<Monolith>,
}

#[derive(Debug, Clone, Serialize)]
struct Monolith {
    id: String,
    region: String,
    rooms: Vec<Room>,
}

#[derive(Debug, Clone, Serialize)]
struct Room {
    name: String,
    clients: i32,
}

fn return_sample_state() -> SystemState {
    SystemState({
        vec![
            Balancer {
                id: "154d9d41-128c-45ab-83d8-28661882c9e3".to_string(),
                region: "ewr".to_string(),
                monoliths: vec![
                    Monolith {
                        id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf".to_string(),
                        region: "ewr".to_string(),
                        rooms: vec![
                            Room {
                                name: "foo".to_string(),
                                clients: 2,
                            },
                            Room {
                                name: "bar".to_string(),
                                clients: 0,
                            },
                        ],
                    },
                    Monolith {
                        id: "419580cb-f576-4314-8162-45340c94bae1".to_string(),
                        region: "ewr".to_string(),
                        rooms: vec![Room {
                            name: "baz".to_string(),
                            clients: 3,
                        }],
                    },
                    Monolith {
                        id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac".to_string(),
                        region: "cdg".to_string(),
                        rooms: vec![Room {
                            name: "qux".to_string(),
                            clients: 0,
                        }],
                    },
                ],
            },
            Balancer {
                id: "c91d183c-980e-4160-b196-43658148f469".to_string(),
                region: "ewr".to_string(),
                monoliths: vec![
                    Monolith {
                        id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf".to_string(),
                        region: "ewr".to_string(),
                        rooms: vec![
                            Room {
                                name: "foo".to_string(),
                                clients: 1,
                            },
                            Room {
                                name: "bar".to_string(),
                                clients: 2,
                            },
                        ],
                    },
                    Monolith {
                        id: "419580cb-f576-4314-8162-45340c94bae1".to_string(),
                        region: "ewr".to_string(),
                        rooms: vec![Room {
                            name: "baz".to_string(),
                            clients: 0,
                        }],
                    },
                    Monolith {
                        id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac".to_string(),
                        region: "cdg".to_string(),
                        rooms: vec![Room {
                            name: "qux".to_string(),
                            clients: 0,
                        }],
                    },
                ],
            },
            Balancer {
                id: "5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0".to_string(),
                region: "cdg".to_string(),
                monoliths: vec![
                    Monolith {
                        id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf".to_string(),
                        region: "ewr".to_string(),
                        rooms: vec![
                            Room {
                                name: "foo".to_string(),
                                clients: 0,
                            },
                            Room {
                                name: "bar".to_string(),
                                clients: 0,
                            },
                        ],
                    },
                    Monolith {
                        id: "419580cb-f576-4314-8162-45340c94bae1".to_string(),
                        region: "ewr".to_string(),
                        rooms: vec![Room {
                            name: "baz".to_string(),
                            clients: 0,
                        }],
                    },
                    Monolith {
                        id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac".to_string(),
                        region: "cdg".to_string(),
                        rooms: vec![Room {
                            name: "qux".to_string(),
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
fn serve_state() -> Json<SystemState> {
    Json(return_sample_state())
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let (discovery_tx, _discovery_rx) = tokio::sync::mpsc::channel(2);
    let discovery = DnsMonolithDiscoverer::new(DnsDiscoveryConfig {
        monolith_port: 8081,
        dns_server: None,
        query: "balancer".to_string(),
    });
    start_discovery_task(discovery, discovery_tx);
    let _rocket = rocket::build()
        .attach(cors::Cors)
        .mount("/", routes![status, cors::handle_preflight, serve_state])
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
