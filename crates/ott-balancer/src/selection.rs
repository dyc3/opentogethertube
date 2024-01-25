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

    use crate::discovery::{HostOrIp, MonolithConnectionConfig};
    use crate::monolith::{BalancerMonolith, NewMonolith};
    use ott_balancer_protocol::*;

    // Want to test min by with compare, basically check that the monolith with the min number of rooms is selected.
    // For this I think we need two monoliths, or maybe three, to test against. Each with a varying number of rooms
    #[tokio::test]
    async fn test_min_by() {
        let _room_name_one = RoomName::from("room one");
        let _room_name_two = RoomName::from("room two");
        let _room_name_three = RoomName::from("room three");
        let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_outbound_tx = Arc::new(monolith_outbound_tx);
        let (client_inbound_tx, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_id = uuid::Uuid::new_v4().into();

        let _monolith_one = BalancerMonolith::new(
            NewMonolith {
                id: monolith_id,
                region: "unknown".into(),
                config: MonolithConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 3002,
                },
                proxy_port: 3000,
            },
            monolith_outbound_tx,
            client_inbound_tx,
        );
    }
}
