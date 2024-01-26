use rand::seq::IteratorRandom;

use crate::monolith::BalancerMonolith;

#[derive(Debug, Default)]
pub struct MinRoomsSelector;
pub trait MonolithSelection: std::fmt::Debug {
    fn select_monolith<'a>(
        &'a self,
        monolith: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith>;

    fn random_monolith<'a>(
        &'a self,
        monolith: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith>;
}

impl MonolithSelection for MinRoomsSelector {
    fn select_monolith<'a>(
        &'a self,
        monolith: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith> {
        fn cmp(x: &BalancerMonolith, y: &BalancerMonolith) -> std::cmp::Ordering {
            x.rooms().len().cmp(&y.rooms().len())
        }

        let selected = monolith.iter().min_by(|x, y| cmp(x, y));
        match selected {
            Some(s) => Ok(s),
            None => anyhow::bail!("no monoliths available"),
        }
    }

    fn random_monolith<'a>(
        &'a self,
        monolith: Vec<&'a BalancerMonolith>,
    ) -> anyhow::Result<&BalancerMonolith> {
        let selected = monolith
            .iter()
            .choose(&mut rand::thread_rng())
            .ok_or_else(|| anyhow::anyhow!("no monoliths available"))?;
        Ok(selected)
    }
}

#[cfg(test)]
mod test {
    use std::net::Ipv4Addr;
    use std::sync::Arc;

    use crate::balancer::BalancerContext;
    use crate::discovery::{HostOrIp, MonolithConnectionConfig};
    use crate::monolith::{BalancerMonolith, NewMonolith};
    use crate::room::RoomLocator;
    use ott_balancer_protocol::*;

    #[tokio::test]
    async fn test_min_by() {
        let mut ctx = BalancerContext::new();
        let room_one = RoomName::from("room one");
        let room_two = RoomName::from("room two");
        let room_three = RoomName::from("room three");
        let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_outbound_tx_one = Arc::new(monolith_outbound_tx);
        let (client_inbound_tx_one, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_id_one = uuid::Uuid::new_v4().into();

        let monolith_one = BalancerMonolith::new(
            NewMonolith {
                id: monolith_id_one,
                region: "unknown".into(),
                config: MonolithConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 3002,
                },
                proxy_port: 3000,
            },
            monolith_outbound_tx_one,
            client_inbound_tx_one,
        );

        let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_outbound_tx_two = Arc::new(monolith_outbound_tx);
        let (client_inbound_tx_two, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_id_two = uuid::Uuid::new_v4().into();

        let monolith_two = BalancerMonolith::new(
            NewMonolith {
                id: monolith_id_two,
                region: "unknown".into(),
                config: MonolithConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 3002,
                },
                proxy_port: 3000,
            },
            monolith_outbound_tx_two,
            client_inbound_tx_two,
        );

        ctx.add_monolith(monolith_one);
        ctx.add_room(room_one.clone(), RoomLocator::new(monolith_id_one, 0))
            .expect("failed to add room");
        ctx.add_room(room_two.clone(), RoomLocator::new(monolith_id_one, 0))
            .expect("failed to add room");

        ctx.add_monolith(monolith_two);
        ctx.add_room(room_three.clone(), RoomLocator::new(monolith_id_two, 0))
            .expect("failed to add room");

        let filtered = ctx.filter_monoliths();
        let _selected = ctx
            .monolith_selection
            .select_monolith(filtered)
            .expect("failed to select monolith");

        // assert_eq!(selected.id(), monolith_two.id())
    }
}
