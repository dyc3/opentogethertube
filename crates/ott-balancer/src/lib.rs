use std::net::Ipv6Addr;
use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use balancer::{start_dispatcher, Balancer, BalancerContext};
use clap::Parser;
use hyper::server::conn::http1;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tracing::{error, info};
use tracing_subscriber::prelude::__tracing_subscriber_SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

use crate::config::{BalancerConfig, DiscoveryConfig};
use crate::discovery::start_discovery_task;
use crate::service::BalancerService;

pub mod balancer;
pub mod client;
pub mod config;
pub mod connection;
pub mod discovery;
pub mod messages;
pub mod monolith;
pub mod room;
pub mod selection;
pub mod service;

pub async fn run() -> anyhow::Result<()> {
    let args = config::Cli::parse();

    let loaded_config = BalancerConfig::load(&args.config_path);

    if args.validate {
        match loaded_config {
            Ok(()) => {
                eprintln!("Configuration is valid");
                std::process::exit(0);
            }
            Err(err) => {
                eprintln!("Configuration is invalid");
                eprintln!("Error loading configuration: {:?}", err);
                std::process::exit(1);
            }
        }
    }

    let config = BalancerConfig::get();

    let console_layer = if args.remote_console {
        console_subscriber::ConsoleLayer::builder()
            .server_addr((
                Ipv6Addr::UNSPECIFIED,
                console_subscriber::Server::DEFAULT_PORT,
            ))
            .spawn()
    } else {
        console_subscriber::ConsoleLayer::builder().spawn()
    };
    let fmt_layer = tracing_subscriber::fmt::layer();
    let filter = args.build_tracing_filter();
    let filter_layer = EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new(filter))?;
    tracing_subscriber::registry()
        .with(console_layer)
        .with(filter_layer)
        .with(fmt_layer)
        .init();
    info!("Loaded config: {:?}", config);

    let (discovery_tx, discovery_rx) = tokio::sync::mpsc::channel(2);

    info!("Starting balancer");
    let ctx = Arc::new(RwLock::new(BalancerContext::new()));
    let balancer = Balancer::new(ctx.clone());
    let service_link = balancer.new_link();
    let conman_link = balancer.new_link();
    let _dispatcher_handle = start_dispatcher(balancer)?;
    info!("Dispatcher started");

    info!("Starting monolith discovery");
    let _discovery_handle = match &config.discovery {
        DiscoveryConfig::Fly(config) => {
            let discovery = discovery::FlyMonolithDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
        DiscoveryConfig::Manual(config) => {
            let discovery = discovery::ManualMonolithDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
        DiscoveryConfig::Harness(config) => {
            let discovery = discovery::HarnessMonolithDiscoverer::new(config.clone());
            start_discovery_task(discovery, discovery_tx)
        }
    };
    info!("Monolith discovery started");

    info!("Starting connection manager");
    let mut conman = connection::MonolithConnectionManager::new(discovery_rx, conman_link);
    let _conman_handle = tokio::task::Builder::new()
        .name("connection manager")
        .spawn(async move {
            loop {
                if let Err(err) = conman.do_connection_job().await {
                    error!("Error in connection manager: {:?}", err);
                }
            }
        });

    let bind_addr6: SocketAddr =
        SocketAddr::new(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0).into(), config.port);

    let service = BalancerService {
        ctx,
        link: service_link,
        addr: bind_addr6,
    };

    // on linux, binding ipv6 will also bind ipv4
    let listener6 = TcpListener::bind(bind_addr6)
        .await
        .context("binding primary inbound socket")?;

    info!("Serving on {}", bind_addr6);
    loop {
        let (stream, addr) = tokio::select! {
            stream = listener6.accept() => {
                let (stream, addr) = stream?;
                (stream, addr)
            }
        };

        let mut service = service.clone();
        service.addr = addr;

        let io = hyper_util::rt::TokioIo::new(stream);

        // Spawn a tokio task to serve multiple connections concurrently
        let result = tokio::task::Builder::new()
            .name("serve http")
            .spawn(async move {
                let conn = http1::Builder::new()
                    .serve_connection(io, service)
                    .with_upgrades();
                if let Err(err) = conn.await {
                    error!("Error serving connection: {:?}", err);
                }
            });
        if let Err(err) = result {
            error!("Error spawning task to serve http: {:?}", err);
        }
    }
}
