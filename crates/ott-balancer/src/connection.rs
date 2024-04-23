//! Manages connections to Monoliths.

use std::collections::{HashMap, HashSet};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::monolith::{MsgB2M, MsgM2B};
use ott_common::discovery::{ConnectionConfig, ServiceDiscoveryMsg};
use tokio_tungstenite::{connect_async, WebSocketStream};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};
use tungstenite::protocol::frame::coding::CloseCode;
use tungstenite::protocol::CloseFrame;
use tungstenite::Message;

use crate::balancer::BalancerLink;
use crate::messages::SocketMessage;
use crate::monolith::NewMonolith;
use ott_balancer_protocol::monolith::B2MInit;
use ott_balancer_protocol::*;
use uuid::Uuid;

use once_cell::sync::Lazy;

pub static BALANCER_ID: Lazy<BalancerId> = Lazy::new(|| Uuid::new_v4().into());

pub struct MonolithConnectionManager {
    discovery_rx: tokio::sync::mpsc::Receiver<ServiceDiscoveryMsg>,
    link: BalancerLink,

    monoliths: HashSet<ConnectionConfig>,
    connection_tasks: HashMap<ConnectionConfig, ActiveConnection>,
}

impl MonolithConnectionManager {
    pub fn new(
        discovery_rx: tokio::sync::mpsc::Receiver<ServiceDiscoveryMsg>,
        link: BalancerLink,
    ) -> Self {
        Self {
            discovery_rx,
            link,
            monoliths: Default::default(),
            connection_tasks: Default::default(),
        }
    }

    pub async fn do_connection_job(&mut self) -> anyhow::Result<()> {
        let msg = self
            .discovery_rx
            .recv()
            .await
            .ok_or_else(|| anyhow::anyhow!("Discovery channel closed"))?;
        debug!("Monolith discovery message: {:?}", msg);
        for m in &msg.removed {
            self.monoliths.remove(m);
            if let Some(active) = self.connection_tasks.remove(m) {
                active.cancel.cancel();
                active.handle.await?;
            }
        }

        for conf in msg.added {
            info!("Connecting to monolith at {}", conf.uri());
            let link = self.link.clone();
            self.monoliths.insert(conf.clone());

            let cancel = CancellationToken::new();
            let conf_clone = conf.clone();
            let cancel_clone = cancel.clone();
            let handle = tokio::task::Builder::new()
                .name("monolith connection")
                .spawn(async move {
                    connect_and_maintain(conf_clone, link.clone(), cancel_clone).await
                })?;
            let active = ActiveConnection { handle, cancel };

            self.connection_tasks.insert(conf, active);
        }

        Ok(())
    }
}

async fn connect_and_maintain(
    conf: ConnectionConfig,
    link: BalancerLink,
    cancel: CancellationToken,
) {
    let mut stream: WebSocketStream<_>;
    loop {
        // start the initial connection as if this is a brand new connection
        loop {
            tokio::select! {
                result = connect_async(conf.uri()) => {
                    match result {
                        Ok((s, _)) => {
                            stream = s;
                            break;
                        },
                        Err(err) => {
                            error!("Failed to connect to monolith: {}", err);
                            tokio::time::sleep(Duration::from_secs(5)).await;
                            continue;
                        }
                    }
                }

                _ = cancel.cancelled() => {
                    info!("Monolith connection cancelled, safely ending: {}", conf.uri());
                    return;
                }
            }
        }

        let init = B2MInit { id: *BALANCER_ID };
        stream
            .send(Message::Text(
                serde_json::to_string(&MsgB2M::Init(init)).unwrap(),
            ))
            .await
            .unwrap_or_else(|err| {
                error!("Failed to send init message to monolith: {}", err);
            });

        let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
        let Ok(Some(Ok(message))) = result else {
            let _ = stream
                .close(Some(CloseFrame {
                    code: CloseCode::Library(4000),
                    reason: "did not send init".into(),
                }))
                .await;
            warn!(
                "Monolith misbehaved, did not send init, timed out: {}",
                conf.uri()
            );
            return;
        };

        // Handle connection initialization
        let mut outbound_rx;
        let monolith_id;
        match message {
            Message::Text(text) => {
                let jd = &mut serde_json::Deserializer::from_str(&text);
                let message: MsgM2B = match serde_path_to_error::deserialize(jd) {
                    Ok(msg) => msg,
                    Err(err) => {
                        warn!("failed to deserialize monolith message: {:?}", err);
                        let _ = stream
                            .close(Some(CloseFrame {
                                code: CloseCode::Protocol,
                                reason: "failed to deserialize message".into(),
                            }))
                            .await;
                        return;
                    }
                };

                match message {
                    MsgM2B::Init(init) => {
                        monolith_id = init.id;
                        debug!("monolith sent init, handing off to balancer");
                        let monolith = NewMonolith {
                            id: monolith_id,
                            region: init.region,
                            config: conf.clone(),
                            proxy_port: init.port,
                        };

                        let Ok(rx) = link.send_monolith(monolith).await else {
                            let _ = stream
                                .close(Some(CloseFrame {
                                    code: CloseCode::Library(4000),
                                    reason: "failed to send monolith to balancer".into(),
                                }))
                                .await;
                            warn!("Could not send Monolith to balancer: {}", conf.uri());
                            return;
                        };
                        info!("Monolith {id} linked to balancer", id = monolith_id);
                        outbound_rx = rx;
                    }
                    _ => {
                        let _ = stream
                            .close(Some(CloseFrame {
                                code: CloseCode::Protocol,
                                reason: "did not send init".into(),
                            }))
                            .await;
                        warn!("Monolith misbehaved, did not send init: {}", conf.uri());
                        return;
                    }
                }
            }
            _ => {
                return;
            }
        }

        loop {
            tokio::select! {
                msg = outbound_rx.recv() => {
                    if let Some(SocketMessage::Message(msg)) = msg {
                        debug!(event = "ws", balancer_id = %*BALANCER_ID,  node_id = %monolith_id, direction = "tx");
                        if let Err(err) = stream.send(msg).await {
                            error!("Error sending ws message to monolith: {:?}", err);
                            break;
                        }
                    } else {
                        continue;
                    }
                }

                msg = stream.next() => {
                    if let Some(Ok(msg)) = msg {
                        let msg = match msg {
                            Message::Close(frame) => {
                                let close_code = frame.map(|f| f.code).unwrap_or(CloseCode::Abnormal);
                                info!(%monolith_id, %close_code, "Monolith websocket stream ended");
                                break;
                            }
                            Message::Ping(ping) => {
                                if let Err(err) = stream.send(Message::Pong(ping)).await {
                                    error!("Error sending pong to monolith: {:?}", err);
                                    break;
                                }
                                continue;
                            }
                            _ => msg,
                        };

                        debug!(event = "ws", balancer_id = %*BALANCER_ID,  node_id = %monolith_id, direction = "rx");
                        if let Err(err) = link
                            .send_monolith_message(monolith_id, SocketMessage::Message(msg))
                            .await {
                                error!("Error sending monolith message to balancer: {:?}", err);
                                break;
                            }
                    } else {
                        info!(%monolith_id, uri = %conf.uri(), "Monolith disconnected, notifying balancer");
                        break;
                    }
                }

                _ = cancel.cancelled() => {
                    info!(monolith_id = %monolith_id, "Monolith connection cancelled, safely ending");
                    break;
                }
            }
        }
        outbound_rx.close();
        // we need to notify the balancer that this monolith is dead
        // because otherwise the rooms won't get reallocated to another monolith
        info!(%monolith_id, uri = %conf.uri(), "Monolith disconnected, notifying balancer");
        #[allow(deprecated)]
        if let Err(err) = link
            .send_monolith_message(monolith_id, SocketMessage::End)
            .await
        {
            error!("Error sending monolith message to balancer: {:?}", err);
        }

        if cancel.is_cancelled() {
            break;
        }

        // wait a bit before reconnecting, in case the monolith is shutting down
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    info!("Monolith connection task ended: {}", conf.uri());
}

struct ActiveConnection {
    handle: tokio::task::JoinHandle<()>,
    cancel: CancellationToken,
}
