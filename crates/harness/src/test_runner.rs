use std::process::{Child, Command};

use test_context::TestContext;
use tracing::warn;

use crate::util::random_unused_port;

pub struct TestRunner {
    pub port: u16,
    pub(crate) child: Child,
}

impl TestRunner {}

impl TestContext for TestRunner {
    /// Set up the Balancer and block until it's ready.
    fn setup() -> Self {
        let port = random_unused_port();
        let child = Command::new("../../target/debug/ott-balancer-bin")
            .env("BALANCER_PORT", format!("{}", port))
            .spawn()
            .expect("Failed to start balancer");

        // TODO: make HTTP requests to healthcheck endpoint until it returns 200

        Self { port, child }
    }

    fn teardown(mut self) {
        if let Err(result) = self.child.kill() {
            warn!("teardown: Failed to kill balancer: {:?}", result);
        }
    }
}
