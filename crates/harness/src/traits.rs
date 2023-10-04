use serde::Serialize;
use tungstenite::Message;

#[async_trait::async_trait]
pub trait WebsocketSender {
    async fn send_raw(&mut self, msg: Message);

    async fn send(&mut self, msg: impl Serialize + Send) {
        let msg = serde_json::to_string(&msg).unwrap();
        self.send_raw(Message::Text(msg)).await;
    }
}
