use ott_common::discovery::{start_discovery_task, DnsDiscoveryConfig, DnsMonolithDiscoverer};

#[macro_use]
extern crate rocket;

mod cors;

/// Serve the current system state
#[get("/state")]
fn serve_state() {
    todo!("Serve the current system state")
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
