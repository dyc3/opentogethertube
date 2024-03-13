use futures_util::SinkExt;
use futures_util::StreamExt;
use once_cell::sync::Lazy;
use ott_common::websocket::HyperWebsocket;
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::broadcast::error::RecvError;

use tungstenite::Message;

pub static EVENT_STREAMER: Lazy<Arc<Mutex<EventStreamer>>> =
    Lazy::new(|| Arc::new(Mutex::new(EventStreamer::new())));

/// Handle a WebSocket connection for streaming state events.
/// Does not block the current task
pub async fn handle_stream_websocket(ws: HyperWebsocket) -> anyhow::Result<()> {
    EVENT_STREAMER.lock().unwrap().handle_new_connection(ws)?;

    Ok(())
}

pub struct EventStreamer {
    event_tx: tokio::sync::broadcast::Sender<String>,
}

impl Default for EventStreamer {
    fn default() -> Self {
        Self::new()
    }
}

impl EventStreamer {
    pub fn new() -> Self {
        let (event_tx, _) = tokio::sync::broadcast::channel(100);
        Self { event_tx }
    }

    pub fn handle_new_connection(&self, ws: HyperWebsocket) -> anyhow::Result<()> {
        let mut recv = self.event_tx.subscribe();
        tokio::task::Builder::new()
            .name("event streamer websocket")
            .spawn(async move {
                let Ok(mut ws) = ws.await else {
                    return;
                };

                loop {
                    tokio::select! {
                        result = recv.recv() => {
                            match result {
                                Ok(event) => {
                                    let msg = Message::Text(event);
                                    if let Err(err) = ws.send(msg).await {
                                        tracing::error!("Error sending event to WebSocket: {}", err);
                                        break;
                                    }
                                }
                                Err(RecvError::Lagged(_)) => {
                                    continue;
                                }
                                Err(_) => {
                                    break;
                                }
                            }
                        }
                        msg = ws.next() => match msg {
                            Some(Ok(msg)) => {
                                if msg.is_close() {
                                    break;
                                }
                            }
                            Some(Err(err)) => {
                                tracing::error!("Error receiving message from WebSocket: {}", err);
                                break;
                            }
                            None => break,
                        },
                        else => break,
                    }
                }
                let _ = ws.close(None).await;
                let _ = ws.flush().await;
            })?;
        Ok(())
    }

    pub fn event_tx(&self) -> tokio::sync::broadcast::Sender<String> {
        self.event_tx.clone()
    }
}

pub struct EventSink {
    pub event_tx: tokio::sync::broadcast::Sender<String>,
}

impl std::io::Write for EventSink {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let event = String::from_utf8_lossy(buf).to_string();
        self.event_tx
            .send(event)
            .map_err(|_| std::io::ErrorKind::Other)?;

        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
