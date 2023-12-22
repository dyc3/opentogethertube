#[tokio::main]
async fn main() -> anyhow::Result<()> {
    ott_balancer::run().await
}
