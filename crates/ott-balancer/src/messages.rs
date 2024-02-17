use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone)]
pub enum SocketMessage {
    Message(Message),
    #[deprecated(note = "This should just switched to rely on Message::Close")]
    End,
}

impl<'de> SocketMessage {
    pub fn deserialize<T: Deserialize<'de>>(&'de self) -> anyhow::Result<T> {
        match self {
            SocketMessage::Message(msg) => {
                let text = msg.to_text()?;
                let jd = &mut serde_json::Deserializer::from_str(text);
                let obj = serde_path_to_error::deserialize(jd)?;
                Ok(obj)
            }
            #[allow(deprecated)]
            SocketMessage::End => anyhow::bail!("SocketMessage::End"),
        }
    }
}

impl From<Message> for SocketMessage {
    fn from(msg: Message) -> Self {
        Self::Message(msg)
    }
}
