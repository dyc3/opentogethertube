use std::{net::Ipv4Addr, sync::Arc};

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use hashring::HashRing;
use ott_balancer::{
    monolith::{BalancerMonolith, NewMonolith},
    selection::{HashRingSelector, MinRoomsSelector, MonolithSelection},
};
use ott_balancer_protocol::{MonolithId, RoomName};
use ott_common::discovery::{ConnectionConfig, HostOrIp};

fn build_monolith() -> BalancerMonolith {
    let new = NewMonolith {
        id: uuid::Uuid::new_v4().into(),
        region: Default::default(),
        config: ConnectionConfig {
            host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
            port: 3002,
        },
        proxy_port: 3000,
    };
    let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
    let monolith_outbound_tx = Arc::new(monolith_outbound_tx);
    let (client_inbound_tx, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
    BalancerMonolith::new(new, monolith_outbound_tx, client_inbound_tx)
}

fn select_monoliths(c: &mut Criterion) {
    c.bench_function("min rooms selector, 2 monoliths", |b| {
        let strategy = MinRoomsSelector;
        let mut m1 = build_monolith();
        m1.add_room(&"foo1".into()).expect("failed to add room");
        m1.add_room(&"foo2".into()).expect("failed to add room");
        let mut m2 = build_monolith();
        m2.add_room(&"foo3".into()).expect("failed to add room");
        let target_room = "bar".into();
        b.iter(|| {
            let monoliths = vec![&m1, &m2];
            let _ = black_box(strategy.select_monolith(&target_room, monoliths));
        });
    });

    c.bench_function("min rooms selector, 5 monoliths", |b| {
        let strategy = MinRoomsSelector;
        let mut m1 = build_monolith();
        m1.add_room(&"foo1".into()).expect("failed to add room");
        m1.add_room(&"foo2".into()).expect("failed to add room");
        let mut m2 = build_monolith();
        m2.add_room(&"foo3".into()).expect("failed to add room");
        let mut m3 = build_monolith();
        m3.add_room(&"foo4".into()).expect("failed to add room");
        m3.add_room(&"foo5".into()).expect("failed to add room");
        m3.add_room(&"foo6".into()).expect("failed to add room");
        let m4 = build_monolith();
        let m5 = build_monolith();
        let target_room = "bar".into();
        b.iter(|| {
            let monoliths = vec![&m1, &m2, &m3, &m4, &m5];
            let _ = black_box(strategy.select_monolith(&target_room, monoliths));
        });
    });

    c.bench_function("min rooms selector, 10 monoliths", |b| {
        let strategy = MinRoomsSelector;
        let mut m1 = build_monolith();
        m1.add_room(&"foo1".into()).expect("failed to add room");
        m1.add_room(&"foo2".into()).expect("failed to add room");
        let mut m2 = build_monolith();
        m2.add_room(&"foo3".into()).expect("failed to add room");
        let mut m3 = build_monolith();
        m3.add_room(&"foo4".into()).expect("failed to add room");
        m3.add_room(&"foo5".into()).expect("failed to add room");
        m3.add_room(&"foo6".into()).expect("failed to add room");
        let m4 = build_monolith();
        let m5 = build_monolith();
        let m6 = build_monolith();
        let m7 = build_monolith();
        let m8 = build_monolith();
        let m9 = build_monolith();
        let m10 = build_monolith();
        let target_room = "bar".into();
        b.iter(|| {
            let monoliths = vec![&m1, &m2, &m3, &m4, &m5, &m6, &m7, &m8, &m9, &m10];
            let _ = black_box(strategy.select_monolith(&target_room, monoliths));
        });
    });

    c.bench_function("just hash ring", |b| {
        let ids: Vec<MonolithId> = (0..10)
            .map(|_| uuid::Uuid::new_v4().into())
            .collect::<Vec<_>>();
        let mut ring = HashRing::new();
        ring.batch_add(ids);
        let target: RoomName = "foo".into();
        b.iter(|| {
            let _ = black_box(ring.get(&target));
        });
    });

    c.bench_function("hash ring selector, 2 monoliths", |b| {
        let strategy = HashRingSelector {
            config: Default::default(),
        };
        let mut m1 = build_monolith();
        m1.add_room(&"foo1".into()).expect("failed to add room");
        m1.add_room(&"foo2".into()).expect("failed to add room");
        let mut m2 = build_monolith();
        m2.add_room(&"foo3".into()).expect("failed to add room");
        let target_room = "bar".into();
        b.iter(|| {
            let monoliths = vec![&m1, &m2];
            let _ = black_box(strategy.select_monolith(&target_room, monoliths));
        });
    });

    c.bench_function("hash ring selector, 5 monoliths", |b| {
        let strategy = HashRingSelector {
            config: Default::default(),
        };
        let mut m1 = build_monolith();
        m1.add_room(&"foo1".into()).expect("failed to add room");
        m1.add_room(&"foo2".into()).expect("failed to add room");
        let mut m2 = build_monolith();
        m2.add_room(&"foo3".into()).expect("failed to add room");
        let mut m3 = build_monolith();
        m3.add_room(&"foo4".into()).expect("failed to add room");
        m3.add_room(&"foo5".into()).expect("failed to add room");
        m3.add_room(&"foo6".into()).expect("failed to add room");
        let m4 = build_monolith();
        let m5 = build_monolith();
        let target_room = "bar".into();
        b.iter(|| {
            let monoliths = vec![&m1, &m2, &m3, &m4, &m5];
            let _ = black_box(strategy.select_monolith(&target_room, monoliths));
        });
    });

    c.bench_function("hash ring selector, 10 monoliths", |b| {
        let strategy = HashRingSelector {
            config: Default::default(),
        };
        let mut m1 = build_monolith();
        m1.add_room(&"foo1".into()).expect("failed to add room");
        m1.add_room(&"foo2".into()).expect("failed to add room");
        let mut m2 = build_monolith();
        m2.add_room(&"foo3".into()).expect("failed to add room");
        let mut m3 = build_monolith();
        m3.add_room(&"foo4".into()).expect("failed to add room");
        m3.add_room(&"foo5".into()).expect("failed to add room");
        m3.add_room(&"foo6".into()).expect("failed to add room");
        let m4 = build_monolith();
        let m5 = build_monolith();
        let m6 = build_monolith();
        let m7 = build_monolith();
        let m8 = build_monolith();
        let m9 = build_monolith();
        let m10 = build_monolith();
        let target_room = "bar".into();
        b.iter(|| {
            let monoliths = vec![&m1, &m2, &m3, &m4, &m5, &m6, &m7, &m8, &m9, &m10];
            let _ = black_box(strategy.select_monolith(&target_room, monoliths));
        });
    });
}

criterion_group!(benches, select_monoliths);
criterion_main!(benches);
