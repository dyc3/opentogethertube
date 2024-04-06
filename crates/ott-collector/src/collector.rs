use std::{collections::HashMap, sync::Arc, time::Duration};

use once_cell::sync::Lazy;
use ott_balancer_protocol::{collector::BalancerState, RoomName};
use ott_common::discovery::{ConnectionConfig, ServiceDiscoveryMsg};
use rocket::futures::StreamExt;
use serde::Deserialize;
use tokio::sync::Mutex;
use tracing::{error, warn};
use tungstenite::handshake::client::{generate_key, Request};
use uuid::Uuid;

use crate::SystemState;

pub static CURRENT_STATE: Lazy<Arc<Mutex<SystemState>>> =
    Lazy::new(|| Arc::new(Mutex::new(SystemState(vec![]))));

pub struct Collector {
    discovery_rx: tokio::sync::mpsc::Receiver<ServiceDiscoveryMsg>,
    events_tx: tokio::sync::mpsc::Sender<String>,
    interval: tokio::time::Duration,
    balancers: Vec<ConnectionConfig>,
    stream_tasks: HashMap<ConnectionConfig, tokio::task::JoinHandle<anyhow::Result<()>>>,
    balancer_api_key: String,
}

impl Collector {
    pub fn new(
        discovery_rx: tokio::sync::mpsc::Receiver<ServiceDiscoveryMsg>,
        events_tx: tokio::sync::mpsc::Sender<String>,
        interval: tokio::time::Duration,
        balancer_api_key: impl ToOwned<Owned = String>,
    ) -> Self {
        Self {
            discovery_rx,
            events_tx,
            interval,
            balancers: Default::default(),
            stream_tasks: Default::default(),
            balancer_api_key: balancer_api_key.to_owned(),
        }
    }

    #[must_use]
    pub fn spawn(mut self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run().await;
            warn!("Collector task ended");
        })
    }

    pub async fn run(&mut self) {
        loop {
            tokio::select! {
                _ = tokio::time::sleep(self.interval) => {
                    let new_state = match self.collect().await {
                        Ok(new_state) => new_state,
                        Err(err) => {
                            error!("Unexpected error collecting system state: {}", err);
                            continue;
                        }
                    };
                    let mut current = CURRENT_STATE.lock().await;
                    *current = new_state;
                }
                Some(msg) = self.discovery_rx.recv() => {
                    self.handle_discovery(msg);
                }
                else => {
                    break;
                }
            }
        }
    }

    pub fn handle_discovery(&mut self, msg: ServiceDiscoveryMsg) {
        debug!(
            "Balancer discovery: {} added, {} removed",
            msg.added.len(),
            msg.removed.len()
        );
        self.balancers.retain(|conf| !msg.removed.contains(conf));
        self.balancers.extend(msg.added);
    }

    pub async fn collect(&mut self) -> anyhow::Result<SystemState> {
        info!("Collecting system state");
        let client = reqwest::Client::new();
        let mut states = vec![];
        for conf in &self.balancers {
            let mut url = conf.uri();
            url.set_path("/api/state");
            url.set_scheme("http").expect("scheme should be valid");

            let resp = client
                .get(url)
                .header("Authorization", format!("Bearer {}", self.balancer_api_key))
                .timeout(Duration::from_secs(3))
                .send()
                .await?;
            if !resp.status().is_success() {
                error!("Failed to fetch state from {:?}", &conf);
                continue;
            }
            let state = resp.json::<BalancerState>().await?;
            states.push(state);
        }
        info!("Collected state from {} balancers", states.len());

        // start stream tasks for new balancers
        for conf in &self.balancers {
            if self.stream_tasks.contains_key(conf) {
                continue;
            }
            debug!("Starting stream from balancer: {:?}", &conf);
            let _conf = conf.clone();
            let events_tx = self.events_tx.clone();
            let _balancer_api_key = self.balancer_api_key.clone();
            let task = tokio::spawn(async move {
                let result =
                    Self::start_stream_events_from_balancer(_conf, events_tx, _balancer_api_key)
                        .await;
                if let Err(err) = result {
                    error!("Event stream failed: {}", err);
                    return Err(err);
                }
                Ok(())
            });
            self.stream_tasks.insert(conf.clone(), task);
        }

        // cleanup stream tasks that have finished
        self.stream_tasks.retain(|_conf, task| !task.is_finished());

        Ok(SystemState(states))
    }

    async fn start_stream_events_from_balancer(
        balancer: ConnectionConfig,
        events_tx: tokio::sync::mpsc::Sender<String>,
        balancer_api_key: impl ToOwned<Owned = String>,
    ) -> anyhow::Result<()> {
        info!("starting stream from balancer: {:?}", &balancer);
        let mut url = balancer.uri();
        url.set_path("/api/state/stream");
        let req = Request::builder()
            .uri(url.to_string())
            .header("Host", url.host().expect("no host").to_string())
            .header("Connection", "Upgrade")
            .header("Upgrade", "websocket")
            .header("Sec-WebSocket-Version", "13")
            .header("Sec-WebSocket-Key", generate_key())
            .header(
                "Authorization",
                format!("Bearer {}", balancer_api_key.to_owned()),
            )
            .body(())?;
        let (mut ws, _) = tokio_tungstenite::connect_async(req).await?;

        loop {
            tokio::select! {
                msg = ws.next() => {
                    match msg {
                        Some(Ok(msg)) => {
                            if msg.is_close() {
                                break;
                            }
                            let msg = msg.to_string();
                            if !should_send(&msg) {
                                continue;
                            }
                            if let Err(err) = events_tx.try_send(msg) {
                                match err {
                                    tokio::sync::mpsc::error::TrySendError::Full(_) => {
                                        warn!("Event bus is full, dropping event");
                                    }
                                    tokio::sync::mpsc::error::TrySendError::Closed(_) => {
                                        warn!("Event bus is closed, stopping stream");
                                        break;
                                    }
                                }
                            }
                        }
                        _ => break,
                    }
                }
                else => {
                    break;
                }
            }
        }
        warn!("stream from balancer {:?} ended", &balancer);

        Ok(())
    }
}

fn should_send(event: &str) -> bool {
    serde_json::from_str::<Event>(event).is_ok()
}

#[derive(Debug, Deserialize)]
#[serde(tag = "event", rename_all = "lowercase")]
#[allow(dead_code)]
#[non_exhaustive]
enum Event {
    Ws(EventWebsocketMessage),
    Proxy(EventProxyRequest),
    Broadcast(EventBroadcast),
}

/// Indicates that a message was sent or received on a websocket connection to a balancer.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct EventWebsocketMessage {
    node_id: Uuid,
    direction: MsgDirection,
    room: Option<RoomName>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct EventProxyRequest {
    node_id: Uuid,
    direction: MsgDirection,
    room: Option<RoomName>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct EventBroadcast {
    node_id: String,
    direction: MsgDirection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum MsgDirection {
    Tx,
    Rx,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::uuid;

    #[test]
    fn test_deserialize_event_ws() {
        let event =
            r#"{"event":"ws","node_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479", "direction": "tx"}"#;
        let event: Event = serde_json::from_str(event).unwrap();
        #[allow(unreachable_patterns)]
        match event {
            Event::Ws(EventWebsocketMessage { node_id, .. }) => {
                assert_eq!(node_id, uuid!("f47ac10b-58cc-4372-a567-0e02b2c3d479"));
            }
            _ => {
                panic!("unexpected event type: {:?}", event);
            }
        }
    }

    #[test]
    fn test_deserialize_event_ws2() {
        let event = r#"{"event":"ws","node_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479", "room": "foo", "direction": "tx"}"#;
        let event: Event = serde_json::from_str(event).unwrap();
        #[allow(unreachable_patterns)]
        match event {
            Event::Ws(EventWebsocketMessage { node_id, room, .. }) => {
                assert_eq!(node_id, uuid!("f47ac10b-58cc-4372-a567-0e02b2c3d479"));
                assert_eq!(room, Some("foo".into()));
            }
            _ => {
                panic!("unexpected event type: {:?}", event);
            }
        }
    }

    #[test]
    fn test_deserialize_event_proxy() {
        let event = r#"{"event":"proxy","node_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479", "direction": "tx"}"#;
        let event: Event = serde_json::from_str(event).unwrap();
        #[allow(unreachable_patterns)]
        match event {
            Event::Proxy(EventProxyRequest { node_id, .. }) => {
                assert_eq!(node_id, uuid!("f47ac10b-58cc-4372-a567-0e02b2c3d479"));
            }
            _ => {
                panic!("unexpected event type: {:?}", event);
            }
        }
    }

    #[test]
    fn test_deserialize_event_proxy2() {
        let event = r#"{"event":"proxy","node_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479", "room": "foo", "direction": "tx"}"#;
        let event: Event = serde_json::from_str(event).unwrap();
        #[allow(unreachable_patterns)]
        match event {
            Event::Proxy(EventProxyRequest { node_id, room, .. }) => {
                assert_eq!(node_id, uuid!("f47ac10b-58cc-4372-a567-0e02b2c3d479"));
                assert_eq!(room, Some("foo".into()));
            }
            _ => {
                panic!("unexpected event type: {:?}", event);
            }
        }
    }

    #[test]
    fn test_deserialize_event_broadcast() {
        let event = r#"{"event":"broadcast","node_id":"foo", "direction": "tx"}"#;
        let event: Event = serde_json::from_str(event).unwrap();
        #[allow(unreachable_patterns)]
        match event {
            Event::Broadcast(EventBroadcast { node_id, .. }) => {
                assert_eq!(node_id, "foo");
            }
            _ => {
                panic!("unexpected event type: {:?}", event);
            }
        }
    }
}
