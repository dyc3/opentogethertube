use harness::{Monolith, TestRunner};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn sample_test(ctx: &mut TestRunner) {
    let m = Monolith::new(ctx).await.unwrap();
    println!("monolith port: {}", m.port());
    assert_ne!(m.port(), 0);

    for _ in 0..10 {
        m.show().await;
        m.hide().await;
    }
}

fn main() {}
