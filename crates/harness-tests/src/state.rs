//! Tests for how the balancer handles room state in the context of managing rooms on monoliths.

use std::time::Duration;

use harness::{BehaviorLoadRooms, Client, Monolith, MonolithBuilder, TestRunner};
use ott_balancer_protocol::monolith::{MsgB2M, UnloadReason};
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

    m_wait_until_msg_matching!(m2, MsgB2M::Unload(_));

    let recv = m2.collect_recv();
    assert!(recv.iter().any(|msg| matches!(msg, MsgB2M::Unload(_))));
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

    m_wait_until_msg_matching!(m2, MsgB2M::Unload(_));

    let mut c = Client::new(ctx).unwrap();
    c.join("foo").await;

    m_wait_until_msg_matching!(m1, MsgB2M::Join(_));
}

#[test_context(TestRunner)]
#[tokio::test]
async fn should_not_unload_rooms_when_balancer_restart(ctx: &mut TestRunner) {
    let mut m = MonolithBuilder::new()
        .behavior(BehaviorLoadRooms)
        .build(ctx)
        .await;
    let mut c1 = Client::new(ctx).unwrap();

    // increase the load epoch past the initial value
    for _ in 0..10 {
        m.load_room("foo").await;
        m.unload_room("foo", UnloadReason::Admin).await;
    }

    m.show().await;
    c1.join("foo").await;
    m_wait_until_msg_matching!(m, MsgB2M::Join(_), "pre restart");
    m.clear_recv();

    ctx.restart_balancer().await;

    m.wait_for_balancer_connect().await;
    c1.disconnect().await;
    c1.join("foo").await;
    m_wait_until_msg_matching!(m, MsgB2M::Join(_), "post restart");
    m.gossip().await;
    let _ = tokio::time::timeout(Duration::from_millis(200), m.wait_recv()).await;

    let recv = m.collect_recv();
    for msg in recv {
        if matches!(msg, MsgB2M::Unload(_)) {
            panic!("expected no unload message from balancer, got {:?}", msg);
        }
    }
}

#[test_context(TestRunner)]
#[tokio::test]
async fn should_update_load_epoch_when_balancer_restart_2_monoliths(ctx: &mut TestRunner) {
    let mut m = MonolithBuilder::new()
        .behavior(BehaviorLoadRooms)
        .build(ctx)
        .await;
    let mut c1 = Client::new(ctx).unwrap();

    // increase the load epoch past the initial value
    for _ in 0..10 {
        m.load_room("foo").await;
        m.unload_room("foo", UnloadReason::Admin).await;
    }

    m.show().await;
    c1.join("foo").await;
    m_wait_until_msg_matching!(m, MsgB2M::Join(_), "pre restart");
    m.clear_recv();

    ctx.restart_balancer().await;
    c1.disconnect().await;

    m.wait_for_balancer_connect().await;
    c1.join("foo").await;
    m_wait_until_msg_matching!(m, MsgB2M::Join(_), "post restart");
    m.gossip().await;
    let _ = tokio::time::timeout(Duration::from_millis(200), m.wait_recv()).await;

    let mut m2 = MonolithBuilder::new()
        .behavior(BehaviorLoadRooms)
        .build(ctx)
        .await;
    m2.show().await;
    m2.load_room("foo").await;

    m_wait_until_msg_matching!(m2, MsgB2M::Unload(_), "m2 load foo");
}
