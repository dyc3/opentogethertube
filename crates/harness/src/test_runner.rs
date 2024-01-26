use std::{collections::HashMap, net::SocketAddr, process::Stdio, sync::Arc};

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
};

use test_context::AsyncTestContext;
use tracing::warn;
use websocket::dataframe::DataFrame;
use websocket::client::sync;

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

        self.child = Self::spawn_balancer(&self.spawn_options)
            .await
            .expect("failed to respawn balancer");
    }

    pub async fn is_alive(&mut self) {
        let ecode = self.child.wait().await.expect("Error: Balancer is not alive");
        assert_eq!(ecode.success(), true);
    }

    /// Spawn a new balancer and wait for it to be ready.
    async fn spawn_balancer(opts: &BalancerSpawnOptions) -> anyhow::Result<Child> {
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

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(100))
            .build()
            .expect("failed to build request client");

        let mut child = Command::new("cargo")
            .args([
                "run",
                "-p",
                "ott-balancer-bin",
                "--",
                "--log-level",
                "debug",
            ])
            .envs(envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start balancer");
        println!("waiting for balancer to start");
        loop {
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
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            anyhow::bail!("Exited with status {}", status);
                        }
                        Ok(None) => {} // process is still running
                        Err(e) => anyhow::bail!("Error waiting for balancer to start: {}", e),
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }
            }
        }

        let child_stdout = BufReader::new(child.stdout.take().expect("failed to get child stdout"));
        let child_stderr = BufReader::new(child.stderr.take().expect("failed to get child stderr"));

        async fn relog_lines(
            mut reader: BufReader<impl tokio::io::AsyncRead + Unpin>,
            prefix: &str,
        ) {
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        println!("{}: {}", prefix, line);
                    }
                    Err(e) => {
                        println!("{} error: {}", prefix, e);
                        break;
                    }
                }
            }
        }

        tokio::spawn(async move {
            relog_lines(child_stdout, "balancer stdout").await;
        });
        tokio::spawn(async move {
            relog_lines(child_stderr, "balancer stderr").await;
        });

        Ok(child)
    }

    /// Create a URL that points to the balancer. This creates URLs that clients should use when connecting to the balancer or making HTTP requests.
    ///
    /// ```no_run
    /// # use test_context::test_context;
    /// # use harness::TestRunner;
    ///
    /// # #[test_context(TestRunner)]
    /// # #[tokio::test]
    /// # async fn sample_test(ctx: &mut TestRunner) {
    /// let client = tokio_tungstenite::connect_async(ctx.url("ws", "/api/room/test")).await.expect("failed to connect");
    /// # }
    /// ````
    #[must_use]
    pub fn url(&self, scheme: impl AsRef<str>, path: impl AsRef<str>) -> reqwest::Url {
        let path = path.as_ref();
        assert!(path.starts_with('/'), "path must start with '/'");
        let built = format!("{}://[::1]:{}{}", scheme.as_ref(), self.port(), path);
        reqwest::Url::parse(&built).expect("failed to parse URL")
    }

    /// Create a URL that points to the balancer. This creates URLs that clients should connect to when making HTTP requests.
    ///
    /// ```no_run
    /// # use test_context::test_context;
    /// # use harness::TestRunner;
    /// # #[test_context(TestRunner)]
    /// # #[tokio::test]
    /// # async fn sample_test(ctx: &mut TestRunner) {
    /// reqwest::get(ctx.http_url("/api/status")).await.expect("http request failed");
    /// }
    /// ````
    #[must_use]
    pub fn http_url(&self, path: impl AsRef<str>) -> reqwest::Url {
        self.url("http", path)
    }
}

#[async_trait::async_trait]
impl AsyncTestContext for TestRunner {
    /// Set up the Balancer and block until it's ready.
    async fn setup() -> Self {
        let mut port;
        let mut harness_port;

        let mut opts;
        let child;
        let mut attempts = 0;
        loop {
            if attempts > 5 {
                panic!("Failed to find an unused port after 5 attempts");
            }
            port = random_unused_port();
            harness_port = random_unused_port();
            // Ensure that the harness port is different from the balancer port.
            if port == harness_port {
                continue;
            }
            attempts += 1;

            opts = BalancerSpawnOptions {
                port,
                harness_port,
                region: None,
            };

            child = match Self::spawn_balancer(&opts).await {
                Ok(child) => child,
                Err(e) => {
                    println!("Failed to spawn balancer: {}", e);
                    continue;
                }
            };

            break;
        }

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
