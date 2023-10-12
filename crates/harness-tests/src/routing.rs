use std::time::Duration;

use harness::{Client, MockRespParts, Monolith, TestRunner};
use ott_balancer_protocol::monolith::{MsgM2B, RoomMetadata};
use test_context::test_context;

#[test_context(TestRunner)]
#[tokio::test]
async fn route_http_to_correct_monolith(ctx: &mut TestRunner) {
    let mut dummy = Monolith::new(ctx).await.unwrap();
    dummy.show().await;

    let mut m = Monolith::new(ctx).await.unwrap();
    m.mock_http_json(
        "/api/room/foo",
        MockRespParts::default(),
        serde_json::json!({
            "name": "foo",
        }),
    );

    m.show().await;
    m.load_room("foo".to_string()).await;

    // Without this sleep, this test can trigger a race condition where the client connects to the balancer before the monolith has the room loaded.
    // This will cause the other monolith to get the room loaded, and the client will connect to that monolith instead.
    // Since the purpose of this test is to test routing, we can just wait a bit for the balancer to acknowledge the room load.
    tokio::time::sleep(Duration::from_millis(100)).await;

    reqwest::get(format!("http://[::1]:{}/api/room/foo", ctx.port))
        .await
        .expect("http request failed")
        .error_for_status()
        .expect("bad http status");

    let reqs = m.collect_mock_http();
    assert_eq!(reqs.len(), 1);
}

#[test_context(TestRunner)]
#[tokio::test]
async fn route_http_to_any_monolith_once(ctx: &mut TestRunner) {
    let mut m1 = Monolith::new(ctx).await.unwrap();
    m1.show().await;
    let mut m2 = Monolith::new(ctx).await.unwrap();
    m2.show().await;

    m1.mock_http_json(
        "/api/user",
        MockRespParts::default(),
        serde_json::json!({
            "name": "foo",
            "isLoggedIn": false,
        }),
    );

    reqwest::get(format!("http://[::1]:{}/api/user", ctx.port))
        .await
        .expect("http request failed")
        .error_for_status()
        .expect("bad http status");

    let reqs1 = m1.collect_mock_http();
    let reqs2 = m2.collect_mock_http();
    assert_eq!(reqs1.len() + reqs2.len(), 1);
}

#[test_context(TestRunner)]
#[tokio::test]
async fn route_http_room_list(ctx: &mut TestRunner) {
    let mut m1 = Monolith::new(ctx).await.unwrap();
    m1.show().await;
    let mut m2 = Monolith::new(ctx).await.unwrap();
    m2.show().await;

    m1.mock_http_json(
        "/api/room/list",
        MockRespParts::default(),
        serde_json::json!([]),
    );

    reqwest::get(format!("http://[::1]:{}/api/room/list", ctx.port))
        .await
        .expect("http request failed")
        .error_for_status()
        .expect("bad http status");

    let reqs1 = m1.collect_mock_http();
    let reqs2 = m2.collect_mock_http();

    // no requests should be made because the room list should be collected from metadata stored in the balancer
    assert_eq!(reqs1.len() + reqs2.len(), 0);
}

#[test_context(TestRunner)]
#[tokio::test]
async fn route_ws_to_correct_monolith(ctx: &mut TestRunner) {
    let mut dummy = Monolith::new(ctx).await.unwrap();
    dummy.show().await;

    let mut m = Monolith::new(ctx).await.unwrap();
    m.show().await;
    m.load_room("foo".to_string()).await;

    // Without this sleep, this test can trigger a race condition where the client connects to the balancer before the monolith has the room loaded.
    // This will cause the other monolith to get the room loaded, and the client will connect to that monolith instead.
    // Since the purpose of this test is to test routing, we can just wait a bit for the balancer to acknowledge the room load.
    tokio::time::sleep(Duration::from_millis(100)).await;

    let mut client = Client::new(ctx).unwrap();
    client.join("foo").await;

    m.wait_recv().await;

    let recvd = m.collect_recv();
    assert_eq!(recvd.len(), 1);
}
