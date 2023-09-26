use std::process::{Child, Command};

use crate::{test::Test, util::random_unused_port};

pub struct TestRunner {
    pub(crate) test: Test,
    balancer_state: BalancerState,
    balancer: Option<BalancerInfo>,
}

impl TestRunner {
    pub fn new(test: Test) -> Self {
        Self {
            test,
            balancer_state: BalancerState::NotStarted,
            balancer: None,
        }
    }

    /// Set up the Balancer and block until it's ready.
    pub fn setup(&mut self) -> anyhow::Result<()> {
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
