use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone)]
pub enum SocketMessage {
    Message(Message),
    End,
}

impl<'de> SocketMessage {
    pub fn deserialize<T: Deserialize<'de>>(&'de self) -> anyhow::Result<T> {
        match self {
            SocketMessage::Message(msg) => {
                let text = msg.to_text()?;
                let obj = serde_json::from_str(text)?;
                Ok(obj)
            }
            SocketMessage::End => anyhow::bail!("SocketMessage::End"),
        }
    }
}

impl From<Message> for SocketMessage {
    fn from(msg: Message) -> Self {
        Self::Message(msg)
    }
}
