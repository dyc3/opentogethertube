use anyhow::Ok;
use ott_balancer_protocol::{
    monolith::{M2BRoomMsg, MsgM2B},
    MonolithId, RoomName,
};
use std::sync::Arc;
use tokio::sync::{mpsc::Receiver, RwLock};

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use ott_balancer::{
    balancer::{start_dispatcher, Balancer, BalancerContext, BalancerLink},
    client::{ClientLink, NewClient},
    config::BalancerConfig,
    discovery::{HostOrIp, MonolithConnectionConfig},
    messages::SocketMessage,
    monolith::NewMonolith,
};

async fn send_msg_monolith(
    link: &BalancerLink,
    m_id: MonolithId,
    c_link: &mut ClientLink,
    msg: SocketMessage,
) -> anyhow::Result<()> {
    link.send_monolith_message(m_id, msg).await?;
    let msg = c_link.outbound_recv().await;
    let _ = black_box(msg);
    // assert!(result.is_ok());
    Ok(())
}

async fn send_msg_client(
    c_link: &mut ClientLink,
    m_recv: &mut Receiver<SocketMessage>,
    msg: SocketMessage,
) -> anyhow::Result<()> {
    c_link.inbound_send(msg).await?;
    let msg = m_recv.recv().await;
    let _ = black_box(msg);
    // assert!(result.is_some());
    Ok(())
}

fn send_messages(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    BalancerConfig::init_default();

    c.bench_function("message latency (monolith, broadcast)", |b| {
        b.to_async(&rt).iter_custom(|iters| async move {
            let m_id = uuid::Uuid::new_v4().into();
            let c_id = uuid::Uuid::new_v4().into();
            let room: RoomName = "foo".into();

            let m2b_msg = SocketMessage::Message(tungstenite::Message::Text(
                serde_json::to_string(&MsgM2B::RoomMsg(M2BRoomMsg {
                    room: room.clone(),
                    client_id: None,
                    payload: serde_json::json!({}),
                }))
                .expect("failed to serialize message"),
            ));

            let ctx = Arc::new(RwLock::new(BalancerContext::new()));
            let balancer = Balancer::new(ctx.clone());
            let link = balancer.new_link();
            let _ = start_dispatcher(balancer);
            let _m_recv = link
                .send_monolith(NewMonolith {
                    id: m_id,
                    region: "unknown".to_owned(),
                    config: MonolithConnectionConfig {
                        host: HostOrIp::Host("localhost".to_owned()),
                        port: 0,
                    },
                    proxy_port: 0,
                })
                .await
                .expect("failed to send monolith");
            let mut c_link = link
                .send_client(NewClient {
                    id: c_id,
                    room,
                    token: "bar".to_owned(),
                })
                .await
                .expect("failed to send client");

            let start = std::time::Instant::now();
            for _ in 0..iters {
                let _ =
                    black_box(send_msg_monolith(&link, m_id, &mut c_link, m2b_msg.clone()).await);
            }
            start.elapsed()
        });
    });

    c.bench_function("message latency (monolith, unicast)", |b| {
        b.to_async(&rt).iter_custom(|iters| async move {
            let m_id = uuid::Uuid::new_v4().into();
            let c_id = uuid::Uuid::new_v4().into();
            let room: RoomName = "foo".into();

            let m2b_msg = SocketMessage::Message(tungstenite::Message::Text(
                serde_json::to_string(&MsgM2B::RoomMsg(M2BRoomMsg {
                    room: room.clone(),
                    client_id: Some(c_id),
                    payload: serde_json::json!({}),
                }))
                .expect("failed to serialize message"),
            ));

            let ctx = Arc::new(RwLock::new(BalancerContext::new()));
            let balancer = Balancer::new(ctx.clone());
            let link = balancer.new_link();
            let _ = start_dispatcher(balancer);
            let _m_recv = link
                .send_monolith(NewMonolith {
                    id: m_id,
                    region: "unknown".to_owned(),
                    config: MonolithConnectionConfig {
                        host: HostOrIp::Host("localhost".to_owned()),
                        port: 0,
                    },
                    proxy_port: 0,
                })
                .await
                .expect("failed to send monolith");
            let mut c_link = link
                .send_client(NewClient {
                    id: c_id,
                    room,
                    token: "bar".to_owned(),
                })
                .await
                .expect("failed to send client");

            let start = std::time::Instant::now();
            for _ in 0..iters {
                let _ =
                    black_box(send_msg_monolith(&link, m_id, &mut c_link, m2b_msg.clone()).await);
            }
            start.elapsed()
        });
    });

    c.bench_function("message latency (client)", move |b| {
        b.to_async(&rt).iter_custom(|iters| async move {
            let client_msg = SocketMessage::Message(tungstenite::Message::Text(
                serde_json::to_string(&serde_json::json!({})).expect("failed to serialize message"),
            ));

            let m_id = uuid::Uuid::new_v4().into();
            let c_id = uuid::Uuid::new_v4().into();
            let room: RoomName = "foo".into();

            let ctx = Arc::new(RwLock::new(BalancerContext::new()));
            let balancer = Balancer::new(ctx.clone());
            let link = balancer.new_link();
            let _ = start_dispatcher(balancer);
            let mut m_recv = link
                .send_monolith(NewMonolith {
                    id: m_id,
                    region: "unknown".to_owned(),
                    config: MonolithConnectionConfig {
                        host: HostOrIp::Host("localhost".to_owned()),
                        port: 0,
                    },
                    proxy_port: 0,
                })
                .await
                .expect("failed to send monolith");
            let mut c_link = link
                .send_client(NewClient {
                    id: c_id,
                    room,
                    token: "bar".to_owned(),
                })
                .await
                .expect("failed to send client");

            let start = std::time::Instant::now();
            for _ in 0..iters {
                let _ =
                    black_box(send_msg_client(&mut c_link, &mut m_recv, client_msg.clone()).await);
            }
            start.elapsed()
        });
    });
}

criterion_group!(benches, send_messages);
criterion_main!(benches);
