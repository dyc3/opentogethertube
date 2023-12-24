use anyhow::Ok;
use ott_balancer_protocol::{
    monolith::{M2BRoomMsg, MsgM2B},
    MonolithId, RoomName,
};
use std::{net::Ipv4Addr, sync::Arc};
use tokio::{
    sync::{mpsc::Receiver, RwLock},
    task::JoinHandle,
};

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

fn set_up_balancer() -> (BalancerLink, JoinHandle<()>) {
    let ctx = Arc::new(RwLock::new(BalancerContext::new()));
    let balancer = Balancer::new(ctx.clone());
    let link = balancer.new_link();
    let handle = start_dispatcher(balancer).expect("failed to start dispatcher");
    (link, handle)
}

fn send_messages(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    BalancerConfig::init_default();

    c.bench_function("mass join 1 room", |b| {
        b.to_async(&rt).iter_custom(|iters| async move {
            let m_id = uuid::Uuid::new_v4().into();
            let room: RoomName = "foo".into();

            let (link, dispatcher_handle) = set_up_balancer();
            link.send_monolith(NewMonolith {
                id: m_id,
                region: "unknown".into(),
                config: MonolithConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 0,
                },
                proxy_port: 0,
            })
            .await
            .expect("failed to add monolith");

            let start = std::time::Instant::now();
            for _ in 0..iters {
                let c_id = uuid::Uuid::new_v4().into();
                let c_link = link
                    .send_client(NewClient {
                        id: c_id,
                        room: room.clone(),
                        token: "bar".to_owned(),
                    })
                    .await
                    .expect("failed to join");
                black_box(c_link);
            }
            let duration = start.elapsed();
            dispatcher_handle.abort();
            duration
        });
    });

    c.bench_function("mass join 20 rooms", |b| {
        b.to_async(&rt).iter_custom(|iters| async move {
            let m_id = uuid::Uuid::new_v4().into();
            let rooms: Vec<RoomName> = (0..20)
                .map(|i| format!("foo{}", i))
                .map(|s| s.into())
                .collect();

            let (link, dispatcher_handle) = set_up_balancer();
            link.send_monolith(NewMonolith {
                id: m_id,
                region: "unknown".into(),
                config: MonolithConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 0,
                },
                proxy_port: 0,
            })
            .await
            .expect("failed to add monolith");

            let start = std::time::Instant::now();
            for i in 0..iters {
                let c_id = uuid::Uuid::new_v4().into();
                let c_link = link
                    .send_client(NewClient {
                        id: c_id,
                        room: rooms[i as usize % rooms.len()].clone(),
                        token: "bar".to_owned(),
                    })
                    .await
                    .expect("failed to join");
                black_box(c_link);
            }
            let duration = start.elapsed();
            dispatcher_handle.abort();
            duration
        });
    });

    c.bench_function("mass join 20 rooms, on 5 monoliths", |b| {
        b.to_async(&rt).iter_custom(|iters| async move {
            let rooms: Vec<RoomName> = (0..20)
                .map(|i| format!("foo{}", i))
                .map(|s| s.into())
                .collect();

            let (link, dispatcher_handle) = set_up_balancer();
            for _ in 0..5 {
                link.send_monolith(NewMonolith {
                    id: uuid::Uuid::new_v4().into(),
                    region: "unknown".into(),
                    config: MonolithConnectionConfig {
                        host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                        port: 0,
                    },
                    proxy_port: 0,
                })
                .await
                .expect("failed to add monolith");
            }

            let start = std::time::Instant::now();
            for i in 0..iters {
                let c_id = uuid::Uuid::new_v4().into();
                let c_link = link
                    .send_client(NewClient {
                        id: c_id,
                        room: rooms[i as usize % rooms.len()].clone(),
                        token: "bar".to_owned(),
                    })
                    .await
                    .expect("failed to join");
                black_box(c_link);
            }
            let duration = start.elapsed();
            dispatcher_handle.abort();
            duration
        });
    });

    c.bench_function(
        "mass join 20 rooms, on 5 monoliths, with regions set",
        |b| {
            b.to_async(&rt).iter_custom(|iters| async move {
                unsafe {
                    BalancerConfig::get_mut().region = "foo".to_owned();
                }

                let rooms: Vec<RoomName> = (0..20)
                    .map(|i| format!("foo{}", i))
                    .map(|s| s.into())
                    .collect();
                let regions = vec!["foo", "bar", "baz"];

                let (link, dispatcher_handle) = set_up_balancer();
                for i in 0..5 {
                    link.send_monolith(NewMonolith {
                        id: uuid::Uuid::new_v4().into(),
                        region: regions[i as usize % regions.len()].to_owned(),
                        config: MonolithConnectionConfig {
                            host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                            port: 0,
                        },
                        proxy_port: 0,
                    })
                    .await
                    .expect("failed to add monolith");
                }

                let start = std::time::Instant::now();
                for i in 0..iters {
                    let c_id = uuid::Uuid::new_v4().into();
                    let c_link = link
                        .send_client(NewClient {
                            id: c_id,
                            room: rooms[i as usize % rooms.len()].clone(),
                            token: "bar".to_owned(),
                        })
                        .await
                        .expect("failed to join");
                    black_box(c_link);
                }
                let duration = start.elapsed();
                dispatcher_handle.abort();
                duration
            });
        },
    );
}

criterion_group!(benches, send_messages);
criterion_main!(benches);
