#[macro_use]
extern crate rocket;

use rocket::serde::json::Json;
use serde::Serialize;

#[derive(Serialize)]
struct SystemState(Vec<Balancer>);

#[derive(Serialize)]
struct Balancer {
    id: String,
    region: String,
    monoliths: Box<[Monolith]>,
}

#[derive(Serialize)]
struct Monolith {
    id: String,
    region: String,
    rooms: Box<[Room]>,
}

#[derive(Serialize)]
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
                monoliths: Box::new([
                    Monolith {
                        id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf".to_string(),
                        region: "ewr".to_string(),
                        rooms: Box::new([
                            Room {
                                name: "foo".to_string(),
                                clients: 2,
                            },
                            Room {
                                name: "bar".to_string(),
                                clients: 0,
                            },
                        ]),
                    },
                    Monolith {
                        id: "419580cb-f576-4314-8162-45340c94bae1".to_string(),
                        region: "ewr".to_string(),
                        rooms: Box::new([Room {
                            name: "baz".to_string(),
                            clients: 3,
                        }]),
                    },
                    Monolith {
                        id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac".to_string(),
                        region: "cdg".to_string(),
                        rooms: Box::new([Room {
                            name: "qux".to_string(),
                            clients: 0,
                        }]),
                    },
                ]),
            },
            Balancer {
                id: "c91d183c-980e-4160-b196-43658148f469".to_string(),
                region: "ewr".to_string(),
                monoliths: Box::new([
                    Monolith {
                        id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf".to_string(),
                        region: "ewr".to_string(),
                        rooms: Box::new([
                            Room {
                                name: "foo".to_string(),
                                clients: 1,
                            },
                            Room {
                                name: "bar".to_string(),
                                clients: 2,
                            },
                        ]),
                    },
                    Monolith {
                        id: "419580cb-f576-4314-8162-45340c94bae1".to_string(),
                        region: "ewr".to_string(),
                        rooms: Box::new([Room {
                            name: "baz".to_string(),
                            clients: 0,
                        }]),
                    },
                    Monolith {
                        id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac".to_string(),
                        region: "cdg".to_string(),
                        rooms: Box::new([Room {
                            name: "qux".to_string(),
                            clients: 0,
                        }]),
                    },
                ]),
            },
            Balancer {
                id: "5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0".to_string(),
                region: "cdg".to_string(),
                monoliths: Box::new([
                    Monolith {
                        id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf".to_string(),
                        region: "ewr".to_string(),
                        rooms: Box::new([
                            Room {
                                name: "foo".to_string(),
                                clients: 0,
                            },
                            Room {
                                name: "bar".to_string(),
                                clients: 0,
                            },
                        ]),
                    },
                    Monolith {
                        id: "419580cb-f576-4314-8162-45340c94bae1".to_string(),
                        region: "ewr".to_string(),
                        rooms: Box::new([Room {
                            name: "baz".to_string(),
                            clients: 0,
                        }]),
                    },
                    Monolith {
                        id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac".to_string(),
                        region: "cdg".to_string(),
                        rooms: Box::new([Room {
                            name: "qux".to_string(),
                            clients: 4,
                        }]),
                    },
                ]),
            },
        ]
    })
}

mod cors;

/// Serve the current system state
#[get("/state")]
fn serve_state() -> Json<SystemState> {
    Json(return_sample_state())
}

#[launch]
fn rocket() -> _ {
    // TODO: spawn discovery tokio task here

    rocket::build()
        .attach(cors::Cors)
        .mount("/", routes![status, cors::handle_preflight, serve_state])
}

#[get("/status")]
fn status() -> &'static str {
    "OK"
}

#[cfg(test)]
mod test {}
