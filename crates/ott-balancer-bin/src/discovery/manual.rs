use tracing::info;

use super::*;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ManualDiscoveryConfig {
    pub monoliths: Vec<MonolithConnectionConfig>,
}

pub struct ManualMonolithDiscoverer {
    config: ManualDiscoveryConfig,
}

impl ManualMonolithDiscoverer {
    pub fn new(config: ManualDiscoveryConfig) -> Self {
        info!("Creating ManualMonolithDiscoverer");
        Self { config }
    }
}

#[async_trait]
impl MonolithDiscovery for ManualMonolithDiscoverer {
    async fn discover(&self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
        Ok(self.config.monoliths.clone())
    }
}
