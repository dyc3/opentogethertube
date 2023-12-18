use std::{collections::HashMap, net::SocketAddr, sync::Arc};

use tokio::process::{Child, Command};

use test_context::AsyncTestContext;
use tracing::warn;

use crate::util::random_unused_port;

pub struct TestRunner {
    spawn_options: BalancerSpawnOptions,
    pub(crate) child: Child,

    pub(crate) monolith_add_tx: tokio::sync::mpsc::Sender<SocketAddr>,
    pub(crate) monolith_remove_tx: tokio::sync::mpsc::Sender<SocketAddr>,

    pub(crate) room_load_epoch: Arc<std::sync::atomic::AtomicU32>,
}

impl TestRunner {
    /// The port that the balancer is listening on for client connections and HTTP requests.
    pub fn port(&self) -> u16 {
        self.spawn_options.port
    }

    /// The region that the balancer is configured to use. If `None`, the balancer will use the default region.
    pub fn region(&self) -> Option<&str> {
        self.spawn_options.region.as_deref()
    }

    /// Set the region that the balancer should use.
    /// **This will also restart the balancer.**
    pub async fn set_region(&mut self, region: impl AsRef<str>) {
        self.spawn_options.region = Some(region.as_ref().to_owned());
        self.restart_balancer().await;
    }

    /// Clear the region that the balancer should use.
    /// **This will also restart the balancer.**
    pub async fn clear_region(&mut self) {
        self.spawn_options.region = None;
        self.restart_balancer().await;
    }

    /// Kill the balancer and start a new one with the same configuration.
    pub async fn restart_balancer(&mut self) {
        println!("restarting balancer");
        if let Err(result) = self.child.kill().await {
            warn!("restart_balancer: Failed to kill balancer: {:?}", result);
        }

        self.child = Self::spawn_balancer(&self.spawn_options).await;
    }

    /// Spawn a new balancer and wait for it to be ready.
    async fn spawn_balancer(opts: &BalancerSpawnOptions) -> Child {
        let mut envs: HashMap<_, _> = HashMap::from_iter([
            ("BALANCER_PORT", format!("{}", opts.port)),
            (
                "BALANCER_DISCOVERY",
                format!("{{method=\"harness\", port={}}}", opts.harness_port),
            ),
        ]);
        if let Some(region) = &opts.region {
            envs.insert("BALANCER_REGION", region.clone());
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
            .envs(envs)
            .spawn()
            .expect("Failed to start balancer");

        loop {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(100))
                .build()
                .expect("failed to build request client");
            match client
                .get(&format!("http://localhost:{}/api/status", opts.port))
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

        child
    }

    /// Create a URL that points to the balancer. This creates URLs that clients should connect to when making HTTP requests.
    pub fn url(&self, path: impl AsRef<str>) -> reqwest::Url {
        let path = path.as_ref();
        assert!(path.starts_with('/'), "path must start with '/'");
        let built = format!("http://[::1]:{}{}", self.port(), path);
        reqwest::Url::parse(&built).expect("failed to parse URL")
    }
}

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

        let opts = BalancerSpawnOptions {
            port,
            harness_port,
            region: None,
        };

        let child = Self::spawn_balancer(&opts).await;

        let (_provider_task, monolith_add_tx, monolith_remove_tx) =
            crate::provider::DiscoveryProvider::connect(harness_port).await;

        Self {
            spawn_options: opts,
            child,
            monolith_add_tx,
            monolith_remove_tx,
            room_load_epoch: Arc::new(std::sync::atomic::AtomicU32::new(0)),
        }
    }

    async fn teardown(mut self) {
        if let Err(result) = self.child.kill().await {
            warn!("teardown: Failed to kill balancer: {:?}", result);
        }
    }
}

#[derive(Debug, Clone)]
struct BalancerSpawnOptions {
    pub port: u16,
    pub harness_port: u16,
    pub region: Option<String>,
}

#[cfg(test)]
mod test {
    use test_context::test_context;

    use super::*;

    #[test_context(TestRunner)]
    #[tokio::test]
    async fn test_balancer_restart(ctx: &mut TestRunner) {
        let port = ctx.port();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(100))
            .build()
            .expect("failed to build request client");
        let response = client
            .get(&format!("http://localhost:{}/api/status", port))
            .send()
            .await
            .expect("failed to send request");
        assert!(response.status().is_success());

        ctx.restart_balancer().await;

        let response = client
            .get(&format!("http://localhost:{}/api/status", port))
            .send()
            .await
            .expect("failed to send request");
        assert!(response.status().is_success());
    }
}
