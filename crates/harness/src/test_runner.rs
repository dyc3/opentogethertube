use std::net::SocketAddr;

use tokio::process::{Child, Command};

use test_context::AsyncTestContext;
use tracing::warn;

use crate::util::random_unused_port;

pub struct TestRunner {
    /// The port that the balancer is listening on for client connections.
    pub port: u16,
    pub(crate) child: Child,

    pub(crate) monolith_add_tx: tokio::sync::mpsc::Sender<SocketAddr>,
    pub(crate) monolith_remove_tx: tokio::sync::mpsc::Sender<SocketAddr>,
}

impl TestRunner {}

#[async_trait::async_trait]
impl AsyncTestContext for TestRunner {
    /// Set up the Balancer and block until it's ready.
    async fn setup() -> Self {
        let mut port;
        let mut harness_port;
        loop {
            port = random_unused_port();
            harness_port = random_unused_port();
            // Ensure that the harness port is different from the balancer port.
            if port != harness_port {
                break;
            }
        }

        let child = Command::new("cargo")
            .args([
                "run",
                "-p",
                "ott-balancer-bin",
                "--",
                "--log-level",
                "debug",
            ])
            .env("BALANCER_PORT", format!("{}", port))
            .env(
                "BALANCER_DISCOVERY",
                format!("{{method=\"harness\", port={}}}", harness_port),
            )
            .spawn()
            .expect("Failed to start balancer");

        loop {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(100))
                .build()
                .expect("failed to build request client");
            match client
                .get(&format!("http://localhost:{}/api/status", port))
                .send()
                .await
            {
                Ok(response) => {
                    if response.status().is_success() {
                        break;
                    }
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }
            }
        }

        let (_provider_task, monolith_add_tx, monolith_remove_tx) =
            crate::provider::DiscoveryProvider::connect(harness_port).await;

        Self {
            port,
            child,
            monolith_add_tx,
            monolith_remove_tx,
        }
    }

    async fn teardown(mut self) {
        if let Err(result) = self.child.kill().await {
            warn!("teardown: Failed to kill balancer: {:?}", result);
        }
    }
}
