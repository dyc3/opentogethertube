use std::time::Duration;

use harness::{Monolith, TestRunner};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn sample_test(_ctx: &mut TestRunner) {
    let m = Monolith::new().await.unwrap();
    println!("monolith port: {}", m.port());
    assert_ne!(m.port(), 0);

    tokio::time::sleep(Duration::from_secs(8)).await;
}

fn main() {}
