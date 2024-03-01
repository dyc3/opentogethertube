use std::sync::Arc;

use clap::Parser;
use collector::{Collector, CURRENT_STATE};
use ott_balancer_protocol::collector::BalancerState;
use ott_common::discovery::{
    start_discovery_task, DiscoveryConfig, DnsServiceDiscoverer, FlyServiceDiscoverer,
    HarnessServiceDiscoverer, ManualServiceDiscoverer,
};
use rocket::{serde::json::Json, State};
use serde::Serialize;
use tokio::sync::Mutex;

#[macro_use]
extern crate rocket;

mod collector;
mod config;
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
    let args = config::Cli::parse();

    let config = config::CollectorConfig::load(&args.config_path)?;

    let (discovery_tx, discovery_rx) = tokio::sync::mpsc::channel(2);

    let _discovery_handle = match &config.discovery {
        DiscoveryConfig::Dns(config) => {
            let discovery = DnsServiceDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
        DiscoveryConfig::Fly(config) => {
            let discovery = FlyServiceDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
        DiscoveryConfig::Manual(config) => {
            let discovery = ManualServiceDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
        DiscoveryConfig::Harness(config) => {
            let discovery = HarnessServiceDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
    };

    let _collector_handle = Collector::new(discovery_rx, config.collect_interval).spawn();

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
