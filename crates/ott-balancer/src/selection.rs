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
