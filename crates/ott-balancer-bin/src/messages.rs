use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone)]
pub struct SocketMessage(pub Message);

impl<'de> SocketMessage {
    pub fn deserialize<T: Deserialize<'de>>(&'de self) -> anyhow::Result<T> {
        let text = self.0.to_text()?;
        let obj = serde_json::from_str(text)?;

        Ok(obj)
    }
}
