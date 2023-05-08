use std::{net::SocketAddr, sync::Arc};

use balancer::{start_dispatcher, Balancer, BalancerContext};
use hyper::server::conn::http1;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tracing::{error, info};
use tracing_subscriber::prelude::__tracing_subscriber_SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

use crate::service::BalancerService;

mod balancer;
mod client;
mod messages;
mod monolith;
mod service;
mod websocket;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let console_layer = console_subscriber::spawn();
    let fmt_layer = tracing_subscriber::fmt::layer();
    let filter_layer =
        EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new("debug"))?;
    tracing_subscriber::registry()
        .with(console_layer)
        .with(filter_layer)
        .with(fmt_layer)
        .init();

    info!("Starting balancer");
    let ctx = Arc::new(RwLock::new(BalancerContext::new()));
    let balancer = Balancer::new(ctx.clone());
    let link = balancer.new_link();
    let _dispatcher_handle = start_dispatcher(balancer)?;
    info!("Dispatcher started");

    let service = BalancerService { ctx, link };

    // TODO: make configurable
    let addr = SocketAddr::from(([127, 0, 0, 1], 8081));

    let listener = TcpListener::bind(addr).await?;

    info!("Serving on {}", addr);
    loop {
        let (stream, _) = listener.accept().await?;

        let service = service.clone();

        // Spawn a tokio task to serve multiple connections concurrently
        tokio::task::spawn(async move {
            let conn = http1::Builder::new()
                .serve_connection(stream, service)
                .with_upgrades();
            if let Err(err) = conn.await {
                error!("Error serving connection: {:?}", err);
            }
        });
    }
}
