use harness::{MockRespParts, Monolith, TestRunner};
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
    m.send(MsgM2B::Loaded {
        name: "foo".to_owned().into(),
        metadata: RoomMetadata::default(),
    })
    .await;

    reqwest::get(format!("http://[::1]:{}/api/room/foo", m.http_port()))
        .await
        .expect("http request failed")
        .error_for_status()
        .expect("bad http status");

    let reqs = m.collect_mock_http();
    assert_eq!(reqs.len(), 1);
}
