use std::time::Duration;

use harness::{Client, Monolith, MonolithBuilder, TestRunner, WebsocketSender};
use test_context::test_context;
use tungstenite::Message;

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

#[test_context(TestRunner)]
#[tokio::test]
async fn should_send_pongs_to_clients(ctx: &mut TestRunner) {
    let mut m = MonolithBuilder::new().build(ctx).await;
    m.show().await;

    let mut c1 = Client::new(ctx).expect("failed to create client");
    c1.join("foo").await;

    c1.send_raw(Message::Ping("foo".into())).await;

    while let Ok(recv) = c1.recv().await {
        if recv.is_pong() {
            assert_eq!(recv, Message::Pong("foo".into()));
            return;
        }
    }
    panic!("No pong received");
}

#[test_context(TestRunner)]
#[tokio::test]
async fn should_send_pongs_to_monolith(ctx: &mut TestRunner) {
    let mut m = MonolithBuilder::new().build(ctx).await;
    m.show().await;

    m.send_raw(Message::Ping("foo".into())).await;
    m.wait_recv().await;

    let recv = m.collect_recv_raw();
    let pongs = recv.iter().filter(|msg| msg.is_pong()).count();
    assert_eq!(pongs, 1);
    let pong = recv.iter().find(|msg| msg.is_pong());
    assert_eq!(pong, Some(&Message::Pong("foo".into())));
}
