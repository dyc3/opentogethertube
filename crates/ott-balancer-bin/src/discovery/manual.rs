use tracing::info;

use super::*;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ManualDiscoveryConfig {
    pub monoliths: Vec<MonolithConnectionConfig>,
}

pub struct ManualMonolithDiscoverer {
    config: ManualDiscoveryConfig,
    discovered: bool,
}

impl ManualMonolithDiscoverer {
    pub fn new(config: ManualDiscoveryConfig) -> Self {
        info!("Creating ManualMonolithDiscoverer");
        Self {
            config,
            discovered: false,
        }
    }
}

#[async_trait]
impl MonolithDiscovery for ManualMonolithDiscoverer {
    async fn discover(&mut self) -> anyhow::Result<Vec<MonolithConnectionConfig>> {
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
