use std::time::Duration;

use harness::{Client, Monolith, TestRunner};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn should_kick_clients_when_monolith_lost(ctx: &mut TestRunner) {
    let mut m = Monolith::new(ctx).await.unwrap();

    m.show().await;

    let mut c1 = Client::new(ctx).unwrap();
    c1.join("foo").await;
    let mut c2 = Client::new(ctx).unwrap();
    c2.join("bar").await;

    m.wait_recv().await;

    m.hide().await;

    tokio::time::sleep(Duration::from_millis(100)).await;

    println!("c1: {:?}", c1.recv().await);
    println!("c2: {:?}", c2.recv().await);
    assert!(!c1.connected());
    assert!(!c2.connected());
}
