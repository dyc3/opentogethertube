use crate::monolith::BalancerMonolith;
use enum_dispatch::enum_dispatch;
use hashring::HashRing;
use ott_balancer_protocol::RoomName;
use rand::seq::IteratorRandom;
use serde::Deserialize;

#[enum_dispatch(MonolithSelectionStrategy)]
pub trait MonolithSelection: std::fmt::Debug {
    fn select_monolith<'a>(
        &'a self,
        room: &RoomName,
        monoliths: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith>;

    fn random_monolith<'a>(
        &'a self,
        monoliths: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith> {
        let selected = monoliths
            .iter()
            .choose(&mut rand::thread_rng())
            .ok_or_else(|| anyhow::anyhow!("no monoliths available"))?;
        Ok(selected)
    }
}

#[derive(Debug, Deserialize, Copy, Clone)]
#[enum_dispatch]
pub enum MonolithSelectionStrategy {
    MinRooms(MinRoomsSelector),
    HashRing(HashRingSelector),
}

impl Default for MonolithSelectionStrategy {
    fn default() -> Self {
        MonolithSelectionStrategy::MinRooms(MinRoomsSelector)
    }
}

#[derive(Debug, Default, Deserialize, Copy, Clone)]
pub struct MinRoomsSelector;

impl MonolithSelection for MinRoomsSelector {
    fn select_monolith<'a>(
        &'a self,
        _room: &RoomName,
        monoliths: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith> {
        fn cmp(x: &BalancerMonolith, y: &BalancerMonolith) -> std::cmp::Ordering {
            x.rooms().len().cmp(&y.rooms().len())
        }

        let selected = monoliths.iter().min_by(|x, y| cmp(x, y));
        match selected {
            Some(s) => Ok(s),
            None => anyhow::bail!("no monoliths available"),
        }
    }
}

#[derive(Debug, Default, Deserialize, Copy, Clone)]
pub struct HashRingSelector;

impl MonolithSelection for HashRingSelector {
    fn select_monolith<'a>(
        &'a self,
        room: &RoomName,
        monoliths: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith> {
        let mut ring = HashRing::new();
        ring.batch_add(monoliths.iter().map(|m| m.id()).collect());

        let id = ring.get(room).ok_or(anyhow::anyhow!("ring hash empty"))?;
        let i = monoliths
            .iter()
            .position(|m| m.id() == *id)
            .ok_or(anyhow::anyhow!("monolith not found"))?;

        Ok(monoliths[i])
    }
}

#[cfg(test)]
mod test {
    use std::net::Ipv4Addr;
    use std::sync::Arc;

    use crate::monolith::{BalancerMonolith, NewMonolith};
    use ott_balancer_protocol::*;
    use ott_common::discovery::{ConnectionConfig, HostOrIp};

    use super::{MinRoomsSelector, MonolithSelection};

    #[tokio::test]
    async fn test_min_by() {
        let room_one = RoomName::from("room one");
        let room_two = RoomName::from("room two");
        let room_three = RoomName::from("room three");
        let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_outbound_tx_one = Arc::new(monolith_outbound_tx);
        let (client_inbound_tx_one, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_id_one = uuid::Uuid::new_v4().into();

        let mut monolith_one = BalancerMonolith::new(
            NewMonolith {
                id: monolith_id_one,
                region: "unknown".into(),
                config: ConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 3002,
                },
                proxy_port: 3000,
            },
            monolith_outbound_tx_one,
            client_inbound_tx_one,
        );

        monolith_one
            .add_room(&room_one)
            .expect("failed to add room");
        monolith_one
            .add_room(&room_two)
            .expect("failed to add room");

        let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_outbound_tx_two = Arc::new(monolith_outbound_tx);
        let (client_inbound_tx_two, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_id_two = uuid::Uuid::new_v4().into();

        let mut monolith_two = BalancerMonolith::new(
            NewMonolith {
                id: monolith_id_two,
                region: "unknown".into(),
                config: ConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 3002,
                },
                proxy_port: 3000,
            },
            monolith_outbound_tx_two,
            client_inbound_tx_two,
        );

        monolith_two
            .add_room(&room_three)
            .expect("failed to add room");

        let monoliths: Vec<&BalancerMonolith> = vec![&monolith_one, &monolith_two];

        let room: RoomName = "foo".into();
        let selected = MinRoomsSelector
            .select_monolith(&room, monoliths)
            .expect("failed to select monolith");

        assert_eq!(selected.id(), monolith_two.id())
    }
}
