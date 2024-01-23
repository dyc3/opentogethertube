use crate::monolith::BalancerMonolith;

#[derive(Debug, Default)]
pub struct MonolithRegistry;
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
