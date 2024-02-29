use std::sync::Arc;

use collector::{Collector, CURRENT_STATE};
use ott_balancer_protocol::collector::BalancerState;
use ott_common::discovery::{start_discovery_task, DnsDiscoveryConfig, DnsMonolithDiscoverer};
use rocket::{serde::json::Json, State};
use serde::Serialize;
use tokio::sync::Mutex;

#[macro_use]
extern crate rocket;

mod collector;
mod cors;

#[derive(Debug, Clone, Serialize)]
pub struct SystemState(Vec<BalancerState>);

/// Serve the current system state
#[get("/state")]
async fn serve_state(state: &State<Arc<Mutex<SystemState>>>) -> Json<SystemState> {
    let s = state.lock().await.clone();
    Json(s)
}

#[rocket::main]
async fn main() -> anyhow::Result<()> {
    let (discovery_tx, discovery_rx) = tokio::sync::mpsc::channel(2);
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
