use std::time::Duration;

use harness::{Monolith, TestRunner};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn sample_test(ctx: &mut TestRunner) {
    let m = Monolith::new(ctx).await.unwrap();
    println!("monolith port: {}", m.port());
    assert_ne!(m.port(), 0);
    m.show().await;

    tokio::time::sleep(Duration::from_secs(30)).await;
}

fn main() {}
