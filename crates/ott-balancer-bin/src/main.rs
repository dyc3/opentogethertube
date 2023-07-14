use std::pin::Pin;
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

    // TODO: make configurable
    // let bind_addr4: SocketAddr = "0.0.0.0:8081".parse().unwrap();
    let bind_addr6: SocketAddr = "[::]:8081".parse().unwrap();

    let service = BalancerService {
        ctx,
        link,
        addr: bind_addr6,
    };

    // let listener4 = TcpListener::bind(bind_addr4).await?;
    let listener6 = TcpListener::bind(bind_addr6).await?;

    info!("Serving on {}", bind_addr6);
    loop {
        let (stream, addr) = tokio::select! {
            // stream = listener4.accept() => {
            //     let (stream, addr) = stream?;
            //     (stream, addr)
            // }
            stream = listener6.accept() => {
                let (stream, addr) = stream?;
                (stream, addr)
            }
        };

        let mut service = service.clone();
        service.addr = addr;

        let io = hyper_util::rt::TokioIo::new(stream);

        // Spawn a tokio task to serve multiple connections concurrently
        tokio::task::spawn(async move {
            let mut conn = http1::Builder::new()
                .serve_connection(io, service)
                .with_upgrades();
            let conn = Pin::new(&mut conn);
            if let Err(err) = conn.await {
                error!("Error serving connection: {:?}", err);
            }
        });
    }
}
