use std::net::SocketAddr;

use tokio::process::{Child, Command};

use test_context::AsyncTestContext;
use tracing::warn;

use crate::util::random_unused_port;

pub struct TestRunner {
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
        let port = random_unused_port();
        let child = Command::new("cargo")
            .args([
                "run",
                "-p",
                "ott-balancer-bin",
                "--",
                "--config-path",
                "../env/balancer-tmp.toml",
            ])
            .env("BALANCER_PORT", format!("{}", port))
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
            crate::provider::DiscoveryProvider::connect(40000).await;

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
