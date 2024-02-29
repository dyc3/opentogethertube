use tracing::info;

use super::*;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ManualDiscoveryConfig {
    pub monoliths: Vec<ConnectionConfig>,
}

pub struct ManualServiceDiscoverer {
    config: ManualDiscoveryConfig,
    discovered: bool,
}

impl ManualServiceDiscoverer {
    pub fn new(config: ManualDiscoveryConfig) -> Self {
        info!("Creating ManualServiceDiscoverer");
        Self {
            config,
            discovered: false,
        }
    }
}

#[async_trait]
impl ServiceDiscoverer for ManualServiceDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<ConnectionConfig>> {
        #[allow(clippy::while_immutable_condition)]
        while self.discovered {
            // we only ever need to discover once because the monoliths are static
            tokio::time::sleep(Duration::MAX).await;
        }
        self.discovered = true;
        Ok(self.config.monoliths.clone())
    }

    fn mode(&self) -> DiscoveryMode {
        DiscoveryMode::Continuous
    }
}
