use std::net::Ipv6Addr;
use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use balancer::{start_dispatcher, Balancer, BalancerContext};
use clap::Parser;
use futures_util::stream::FuturesUnordered;
use futures_util::{FutureExt, StreamExt};
use hyper_util::rt::TokioExecutor;
use hyper_util::server::conn::auto;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tracing::{error, info};
use tracing_subscriber::prelude::__tracing_subscriber_SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, Layer};

use crate::config::BalancerConfig;
use crate::service::BalancerService;
use crate::state_stream::{EventFilter, EventSink, EVENT_STREAMER};
use ott_common::discovery::{
    start_discovery_task, DiscoveryConfig, DnsServiceDiscoverer, FlyServiceDiscoverer,
    HarnessServiceDiscoverer, ManualServiceDiscoverer,
};
pub mod balancer;
pub mod client;
pub mod config;
pub mod connection;
pub mod messages;
pub mod monolith;
pub mod room;
pub mod selection;
pub mod service;
pub mod state_stream;

#[global_allocator]
static ALLOC: jemallocator::Jemalloc = jemallocator::Jemalloc;

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

    let console_layer = if args.console {
        let console_layer = if args.remote_console {
            console_subscriber::ConsoleLayer::builder()
                .with_default_env()
                .server_addr((
                    Ipv6Addr::UNSPECIFIED,
                    console_subscriber::Server::DEFAULT_PORT,
                ))
                .spawn()
        } else {
            console_subscriber::ConsoleLayer::builder()
                .with_default_env()
                .spawn()
        }
        .with_filter(EnvFilter::try_new("tokio=trace,runtime=trace")?);
        Some(console_layer)
    } else {
        None
    };
    let filter = args.build_tracing_filter();
    let filter_layer = EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new(filter))?;
    let fmt_layer = tracing_subscriber::fmt::layer().with_filter(filter_layer);
    let event_tx = { EVENT_STREAMER.lock().unwrap().event_tx() };
    let streamer_filter = EventFilter::new(event_tx.clone());
    let streamer_layer = tracing_subscriber::fmt::layer()
        .json()
        .flatten_event(true)
        .with_current_span(false)
        .with_writer(move || EventSink {
            event_tx: event_tx.clone(),
        })
        .with_filter(EnvFilter::new("debug"))
        .with_filter(streamer_filter);
    tracing_subscriber::registry()
        .with(console_layer)
        .with(streamer_layer)
        .with(fmt_layer)
        .init();
    info!("Args: {:?}", args);
    info!("Loaded config: {:?}", config);

    let (discovery_tx, discovery_rx) = tokio::sync::mpsc::channel(2);

    info!("Starting balancer");

    let ctx = Arc::new(RwLock::new(
        if let Some(selection_strategy) = config.selection_strategy {
            info!("Using selection strategy: {:?}", selection_strategy);
            BalancerContext {
                monolith_selection: selection_strategy.into(),
                ..BalancerContext::new()
            }
        } else {
            info!("Using default selection strategy");
            BalancerContext::new()
        },
    ));

    let balancer = Balancer::new(ctx.clone());
    let service_link = balancer.new_link();
    let conman_link = balancer.new_link();
    let _dispatcher_handle = start_dispatcher(balancer)?;
    info!("Dispatcher started");

    info!("Starting monolith discovery");
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

    let (task_handle_tx, mut task_handle_rx) = tokio::sync::mpsc::channel(10);
    let service = BalancerService {
        ctx,
        link: service_link,
        task_handle_tx,
    };

    // on linux, binding ipv6 will also bind ipv4
    let listener6 = TcpListener::bind(bind_addr6)
        .await
        .context("binding primary inbound socket")?;

    info!("Serving on {}", bind_addr6);
    let mut tasks = FuturesUnordered::new();
    loop {
        let accept_fut = Box::pin(listener6.accept());

        let (stream, _addr) = tokio::select! {
            stream = accept_fut.fuse() => {
                let (stream, addr) = stream?;
                (stream, addr)
            }

            // process completed tasks
            Some(result) = tasks.next() => {
                if let Err(err) = result {
                    error!("Error in http serving task: {:?}", err);
                }
                continue;
            }

            task_handle_rx = task_handle_rx.recv() => {
                if let Some(task_handle) = task_handle_rx {
                    info!("Received task handle");
                    tasks.push(task_handle);
                }
                continue;
            }
        };

        let service = service.clone();
        let io = hyper_util::rt::TokioIo::new(stream);

        // Spawn a tokio task to serve multiple connections concurrently
        let task = tokio::task::Builder::new()
            .name("serve http")
            .spawn(async move {
                let serve = auto::Builder::new(TokioExecutor::new());
                let conn = serve.serve_connection_with_upgrades(io, service);
                if let Err(err) = conn.await {
                    error!("Error serving connection: {:?}", err);
                }
            });

        match task {
            Ok(task) => tasks.push(task),
            Err(err) => error!("Error spawning task to serve http: {:?}", err),
        }
    }
}
