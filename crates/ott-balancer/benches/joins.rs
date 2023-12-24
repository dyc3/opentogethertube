use ott_balancer_protocol::RoomName;
use std::{net::Ipv4Addr, sync::Arc};
use tokio::{sync::RwLock, task::JoinHandle};

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use ott_balancer::{
    balancer::{start_dispatcher, Balancer, BalancerContext, BalancerLink},
    client::NewClient,
    config::BalancerConfig,
    discovery::{HostOrIp, MonolithConnectionConfig},
    monolith::NewMonolith,
};

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
                let regions = ["foo", "bar", "baz"];

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
