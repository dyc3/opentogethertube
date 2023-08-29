//! Manages connections to Monoliths.

use std::collections::{HashMap, HashSet};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use ott_balancer_protocol::monolith::MsgM2B;
use tokio_tungstenite::connect_async;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info};
use tungstenite::protocol::frame::coding::CloseCode;
use tungstenite::protocol::CloseFrame;
use tungstenite::Message;
use uuid::Uuid;

use crate::balancer::BalancerLink;
use crate::discovery::{MonolithConnectionConfig, MonolithDiscoveryMsg};
use crate::messages::SocketMessage;
use crate::monolith::NewMonolith;

pub struct MonolithConnectionManager {
    discovery_rx: tokio::sync::mpsc::Receiver<MonolithDiscoveryMsg>,
    link: BalancerLink,

    monoliths: HashSet<MonolithConnectionConfig>,
    connection_tasks: HashMap<MonolithConnectionConfig, ActiveConnection>,
}

impl MonolithConnectionManager {
    pub fn new(
        discovery_rx: tokio::sync::mpsc::Receiver<MonolithDiscoveryMsg>,
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
        for m in &msg.removed {
            // TODO: cancel connection task and remove from connection_tasks
            self.monoliths.remove(m);
        }

        for conf in msg.added {
            info!("Connecting to monolith at {}", conf.uri());
            let c = conf.clone();
            let link = self.link.clone();
            self.monoliths.insert(conf.clone());

            let cancel = CancellationToken::new();
            let cancel_clone = cancel.clone();
            let handle = tokio::task::Builder::new()
                .name("monolith connection")
                .spawn(async move {
                    match connect_and_maintain(conf.clone(), link.clone(), cancel_clone).await {
                        Ok(_) => {
                            error!("Monolith connection ended, unsafe task end: {}", conf.uri());
                        }
                        Err(err) => {
                            error!("Monolith connection failed, unsafe task end: {}", err);
                        }
                    }
                })?;
            let active = ActiveConnection { handle, cancel };

            self.connection_tasks.insert(c, active);
        }

        Ok(())
    }
}

async fn connect_and_maintain(
    conf: MonolithConnectionConfig,
    link: BalancerLink,
    cancel: CancellationToken,
) -> anyhow::Result<()> {
    // TODO: refactor to not return result to enforce better error handling
    let (mut stream, _) = connect_async(conf.uri()).await?;

    let monolith_id = Uuid::new_v4().into();

    let result = tokio::time::timeout(Duration::from_secs(20), stream.next()).await;
    let Ok(Some(Ok(message))) = result else {
                stream.close(Some(CloseFrame {
                    code: CloseCode::Library(4000),
                    reason: "did not send init".into(),
                })).await?;
                return Ok(());
            };

    // Handle connection initialization
    let mut outbound_rx;
    match message {
        Message::Text(text) => {
            let message: MsgM2B = serde_json::from_str(&text).unwrap();
            match message {
                MsgM2B::Init(init) => {
                    debug!("monolith sent init, handing off to balancer");
                    let monolith = NewMonolith {
                        id: monolith_id,
                        config: conf.clone(),
                        proxy_port: init.port,
                    };
                    let Ok(rx) = link.send_monolith(monolith).await else {
                        stream.close(Some(CloseFrame {
                                    code: CloseCode::Library(4000),
                                    reason: "failed to send monolith to balancer".into(),
                                })).await?;
                                return Ok(());
                            };
                    info!("Monolith {id} linked to balancer", id = monolith_id);
                    outbound_rx = rx;
                }
                _ => {
                    stream
                        .close(Some(CloseFrame {
                            code: CloseCode::Library(4004),
                            reason: "did not send auth token".into(),
                        }))
                        .await?;
                    return Ok(());
                }
            }
        }
        _ => {
            return Ok(());
        }
    }

    loop {
        tokio::select! {
            msg = outbound_rx.recv() => {
                if let Some(SocketMessage::Message(msg)) = msg {
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
                    if let Err(err) = link
                        .send_monolith_message(monolith_id, SocketMessage::Message(msg))
                        .await {
                            error!("Error sending monolith message to balancer: {:?}", err);
                            break;
                        }
                } else {
                    info!("Monolith websocket stream ended, reconnecting: {}", monolith_id);
                    (stream, _) = connect_async(conf.uri()).await?;
                }
            }

            _ = cancel.cancelled() => {
                info!("Monolith connection cancelled, safely ending: {}", monolith_id);
                #[allow(deprecated)]
                if let Err(err) = link
                    .send_monolith_message(monolith_id, SocketMessage::End)
                    .await {
                        error!("Error sending monolith message to balancer: {:?}", err);
                        break;
                    }
                break;
            }
        }
    }

    Ok(())
}

struct ActiveConnection {
    handle: tokio::task::JoinHandle<()>,
    cancel: CancellationToken,
}
