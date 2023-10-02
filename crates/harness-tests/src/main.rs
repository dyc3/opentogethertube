use harness::{Monolith, TestRunner};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn sample_test(ctx: &mut TestRunner) {
    let mut m = Monolith::new(ctx).await.unwrap();
    println!("monolith port: {}", m.port());
    assert_ne!(m.port(), 0);
    m.show().await;
}

/// Add and remove a monolith a bunch of times to make sure that monolith discovery works.
#[test_context(TestRunner)]
#[tokio::test]
async fn discovery_add_remove(ctx: &mut TestRunner) {
    let mut m = Monolith::new(ctx).await.unwrap();
    println!("monolith port: {}", m.port());
    assert_ne!(m.port(), 0);

    for _ in 0..10 {
        m.show().await;
        assert!(m.connected());
        m.hide().await;
        assert!(!m.connected());
    }
}

fn main() {}
