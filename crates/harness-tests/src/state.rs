//! Tests for how the balancer handles room state in the context of managing rooms on monoliths.

use std::time::Duration;

use harness::{Client, Monolith, MonolithBuilder, TestRunner};
use ott_balancer_protocol::monolith::{B2MUnload, MsgB2M};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn should_unload_duplicate_rooms(ctx: &TestRunner) {
    let mut m1 = Monolith::new(ctx).await.unwrap();
    let mut m2 = Monolith::new(ctx).await.unwrap();

    m1.show().await;
    m2.show().await;

    m1.load_room("foo").await;
    m2.load_room("foo").await;

    m2.wait_recv().await;

    let recv = m2.collect_recv();
    assert_eq!(recv.len(), 1);
    assert!(matches!(recv[0], MsgB2M::Unload(B2MUnload { .. })));
}

#[test_context(TestRunner)]
#[tokio::test]
async fn should_unload_duplicate_rooms_and_route_correctly(ctx: &TestRunner) {
    let mut m1 = Monolith::new(ctx).await.unwrap();
    let mut m2 = Monolith::new(ctx).await.unwrap();

    m1.show().await;
    m2.show().await;

    m1.load_room("foo").await;
    m2.load_room("foo").await;

    tokio::time::timeout(Duration::from_millis(100), m2.wait_recv())
        .await
        .expect("timed out waiting for unload");

    let mut c = Client::new(ctx).unwrap();
    c.join("foo").await;

    tokio::time::timeout(Duration::from_millis(100), m1.wait_recv())
        .await
        .expect("timed out waiting for client join");
}

#[test_context(TestRunner)]
#[tokio::test]
async fn emulated_region(ctx: &TestRunner) {
    let mb: Monolith = MonolithBuilder::new().region("foo").build(ctx).await.into();

    assert_eq!(mb.region(), "foo");
}
