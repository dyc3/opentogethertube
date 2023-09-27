use std::process::{Child, Command};

use test_context::TestContext;

use crate::{test::Test, util::random_unused_port};

pub struct TestRunner {
    balancer_state: BalancerState,
    balancer: Option<BalancerInfo>,
}

impl TestRunner {
    pub fn new() -> Self {
        Self {
            balancer_state: BalancerState::NotStarted,
            balancer: None,
        }
    }

    /// Set up the Balancer and block until it's ready.
    pub fn start(&mut self) -> anyhow::Result<()> {
        let port = random_unused_port();
        let child = Command::new("./target/debug/ott-balancer-bin")
            .env("BALANCER_PORT", format!("{}", port))
            .spawn()?;
        self.balancer = Some(BalancerInfo { port, child });
        self.balancer_state = BalancerState::Starting;

        // TODO: make HTTP requests to healthcheck endpoint until it returns 200

        match self.balancer_state {
            BalancerState::Starting => self.balancer_state = BalancerState::Ready,
            _ => anyhow::bail!("Cannot make balancer ready when it is not starting"),
        }

        Ok(())
    }

    pub fn run(&self) -> TestResult {
        Ok(())
    }
}

impl TestContext for TestRunner {
    fn setup() -> Self {
        let mut r = Self::new();
        r.start().expect("Failed to start balancer");
        r
    }

    fn teardown(self) {}
}

pub(crate) enum BalancerState {
    NotStarted,
    Starting,
    Ready,
    Stopped,
}

pub(crate) struct BalancerInfo {
    pub port: u16,
    pub child: Child,
}

pub type TestResult = Result<(), TestError>;

#[derive(Debug, Clone)]
pub enum TestError {
    Unknown,
}
