pub mod client;
pub mod monolith;
mod provider;
pub mod test_runner;
mod traits;
mod util;

pub use client::*;
pub use monolith::*;
pub use test_runner::*;
pub use traits::*;

#[macro_export]
macro_rules! m_wait_until_msg_matching {
    ($monolith:expr, $pattern:pat) => {
        loop {
            tokio::time::timeout(std::time::Duration::from_millis(200), $monolith.wait_recv())
                .await
                .expect(&format!(
                    "timeout waiting for message matching {}",
                    stringify!($pattern)
                ));
            let recv = $monolith.collect_recv();
            if let Some(msg) = recv.iter().find(|msg| matches!(msg, $pattern)) {
                break msg;
            }
        }
    };
    ($monolith:expr, $pattern:pat, $context:literal) => {
        loop {
            tokio::time::timeout(std::time::Duration::from_millis(200), $monolith.wait_recv())
                .await
                .expect(&format!(
                    "[{}] timeout waiting for message matching {}",
                    $context,
                    stringify!($pattern)
                ));
            let recv = $monolith.collect_recv();
            if let Some(msg) = recv.iter().find(|msg| matches!(msg, $pattern)) {
                break msg;
            }
        }
    };
}

#[macro_export]
macro_rules! m_wait_until_msg_matching_raw {
    ($monolith:expr, $pattern:pat) => {
        loop {
            tokio::time::timeout(std::time::Duration::from_millis(200), $monolith.wait_recv())
                .await
                .expect(&format!(
                    "timeout waiting for message matching {}",
                    stringify!($pattern)
                ));
            let recv = $monolith.collect_recv_raw();
            if let Some(msg) = recv.iter().find(|msg| matches!(msg, $pattern)) {
                break msg;
            }
        }
    };
    ($monolith:expr, $pattern:pat, $context:literal) => {
        loop {
            tokio::time::timeout(std::time::Duration::from_millis(200), $monolith.wait_recv())
                .await
                .expect(&format!(
                    "[{}] timeout waiting for message matching {}",
                    $context,
                    stringify!($pattern)
                ));
            let recv = $monolith.collect_recv_raw();
            if let Some(msg) = recv.iter().find(|msg| matches!(msg, $pattern)) {
                break msg;
            }
        }
    };
}
