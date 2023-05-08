use std::{collections::HashMap, sync::Arc};

use ott_balancer_protocol::monolith::{MsgB2M, MsgM2B};
use ott_balancer_protocol::*;
use rand::seq::IteratorRandom;
use serde_json::value::RawValue;
use tokio::sync::RwLock;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, trace};

use crate::monolith::Room;
use crate::{
    client::{BalancerClient, NewClient},
    messages::*,
    monolith::{BalancerMonolith, NewMonolith},
};

pub struct Balancer {
    pub(crate) ctx: Arc<RwLock<BalancerContext>>,

    new_client_rx: tokio::sync::mpsc::Receiver<(
        NewClient,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,
    new_client_tx: tokio::sync::mpsc::Sender<(
        NewClient,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,

    client_msg_rx: tokio::sync::mpsc::Receiver<Context<ClientId, SocketMessage>>,
    client_msg_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,

    new_monolith_rx: tokio::sync::mpsc::Receiver<(
        NewMonolith,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,
    new_monolith_tx: tokio::sync::mpsc::Sender<(
        NewMonolith,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,

    monolith_msg_rx: tokio::sync::mpsc::Receiver<Context<MonolithId, SocketMessage>>,
    monolith_msg_tx: tokio::sync::mpsc::Sender<Context<MonolithId, SocketMessage>>,
}

impl Balancer {
    pub fn new(ctx: Arc<RwLock<BalancerContext>>) -> Self {
        let (new_client_tx, new_client_rx) = tokio::sync::mpsc::channel(20);
        let (client_msg_tx, client_msg_rx) = tokio::sync::mpsc::channel(100);

        let (new_monolith_tx, new_monolith_rx) = tokio::sync::mpsc::channel(20);
        let (monolith_msg_tx, monolith_msg_rx) = tokio::sync::mpsc::channel(100);

        Self {
            ctx,

            new_client_rx,
            new_client_tx,

            client_msg_rx,
            client_msg_tx,

            new_monolith_rx,
            new_monolith_tx,

            monolith_msg_rx,
            monolith_msg_tx,
        }
    }

    pub fn new_link(&self) -> BalancerLink {
        BalancerLink {
            new_client_tx: self.new_client_tx.clone(),
            client_msg_tx: self.client_msg_tx.clone(),

            new_monolith_tx: self.new_monolith_tx.clone(),
            monolith_msg_tx: self.monolith_msg_tx.clone(),
        }
    }

    pub async fn dispatch_loop(&mut self) {
        loop {
            tokio::select! {
                new_client = self.new_client_rx.recv() => {
                    if let Some((new_client, receiver_tx)) = new_client {
                        let ctx = self.ctx.clone();
                        tokio::spawn(async move {
                            match join_client(ctx, new_client, receiver_tx).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to join client: {:?}", err)
                            };
                        });
                    }
                }
                msg = self.client_msg_rx.recv() => {
                    if let Some(msg) = msg {
                        let ctx = self.ctx.clone();
                        tokio::spawn(async move {
                            match dispatch_client_message(ctx, msg).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to dispatch client message: {:?}", err)
                            }
                        });
                    }
                }
                new_monolith = self.new_monolith_rx.recv() => {
                    if let Some((new_monolith, receiver_tx)) = new_monolith {
                        let ctx = self.ctx.clone();
                        tokio::spawn(async move {
                            match join_monolith(ctx, new_monolith, receiver_tx).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to join monolith: {:?}", err)
                            }
                        });
                    }
                }
                msg = self.monolith_msg_rx.recv() => {
                    if let Some(msg) = msg {
                        let ctx = self.ctx.clone();
                        tokio::spawn(async move {
                            match dispatch_monolith_message(ctx, msg).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to dispatch monolith message: {:?}", err)
                            }
                        });
                    }
                }
            }
        }
    }
}

pub fn start_dispatcher(mut balancer: Balancer) -> anyhow::Result<tokio::task::JoinHandle<()>> {
    Ok(tokio::task::Builder::new()
        .name("dispatcher")
        .spawn(async move {
            balancer.dispatch_loop().await;
        })?)
}

#[derive(Clone)]
pub struct BalancerLink {
    new_client_tx: tokio::sync::mpsc::Sender<(
        NewClient,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,
    client_msg_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,

    new_monolith_tx: tokio::sync::mpsc::Sender<(
        NewMonolith,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,
    monolith_msg_tx: tokio::sync::mpsc::Sender<Context<MonolithId, SocketMessage>>,
}

impl BalancerLink {
    pub async fn send_client(
        &self,
        client: NewClient,
    ) -> anyhow::Result<tokio::sync::mpsc::Receiver<SocketMessage>> {
        let (receiver_tx, receiver_rx) = tokio::sync::oneshot::channel();
        self.new_client_tx.send((client, receiver_tx)).await?;
        let receiver = receiver_rx.await?;

        Ok(receiver)
    }

    pub async fn send_client_message(
        &self,
        client_id: ClientId,
        message: SocketMessage,
    ) -> anyhow::Result<()> {
        self.client_msg_tx
            .send(Context::new(client_id, message))
            .await?;
        Ok(())
    }

    pub async fn send_monolith(
        &self,
        monolith: NewMonolith,
    ) -> anyhow::Result<tokio::sync::mpsc::Receiver<SocketMessage>> {
        let (receiver_tx, receiver_rx) = tokio::sync::oneshot::channel();
        self.new_monolith_tx.send((monolith, receiver_tx)).await?;
        let receiver = receiver_rx.await?;

        Ok(receiver)
    }

    pub async fn send_monolith_message(
        &self,
        monolith_id: MonolithId,
        message: SocketMessage,
    ) -> anyhow::Result<()> {
        self.monolith_msg_tx
            .send(Context::new(monolith_id, message))
            .await?;
        Ok(())
    }
}

#[derive(Debug)]
pub struct BalancerContext {
    pub clients: HashMap<ClientId, BalancerClient>,
    pub monoliths: HashMap<MonolithId, BalancerMonolith>,
    pub rooms_to_monoliths: HashMap<RoomName, MonolithId>,
}

impl BalancerContext {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
            monoliths: HashMap::new(),
            rooms_to_monoliths: HashMap::new(),
        }
    }

    pub async fn add_client(
        &mut self,
        client: BalancerClient,
        monolith_id: MonolithId,
    ) -> anyhow::Result<()> {
        info!(
            "adding client {:?} to monolith {:?}",
            client.id, monolith_id
        );
        let Some(monolith) = self.monoliths.get_mut(&monolith_id) else {
            anyhow::bail!("monolith not found");
        };
        monolith.add_client(&client.room, client.id);
        monolith
            .send(&MsgB2M::Join {
                room: client.room.clone(),
                client: client.id,
                token: client.token.clone(),
            })
            .await?;
        self.clients.insert(client.id, client);

        Ok(())
    }

    pub fn remove_client(&mut self, client_id: ClientId) -> anyhow::Result<()> {
        let monolith = self.find_monolith_mut(client_id)?;
        monolith.remove_client(client_id);

        Ok(())
    }

    pub fn add_monolith(&mut self, monolith: BalancerMonolith) {
        self.monoliths.insert(monolith.id(), monolith);
    }

    #[allow(dead_code)]
    pub fn remove_monolith(&mut self, monolith_id: MonolithId) {
        self.monoliths.remove(&monolith_id);
    }

    pub fn add_room(&mut self, room: RoomName, monolith_id: MonolithId) -> anyhow::Result<()> {
        self.monoliths
            .get(&monolith_id)
            .ok_or(anyhow::anyhow!("monolith not found"))?; // check if monolith exists
        self.rooms_to_monoliths.insert(room, monolith_id);
        Ok(())
    }

    pub fn find_monolith_id(&self, client: ClientId) -> anyhow::Result<MonolithId> {
        let client = self
            .clients
            .get(&client)
            .ok_or(anyhow::anyhow!("client not found"))?;
        let monolith_id = self
            .rooms_to_monoliths
            .get(&client.room)
            .ok_or(anyhow::anyhow!("room not found in rooms_to_monoliths"))?;
        Ok(*monolith_id)
    }

    pub fn find_monolith(&self, client: ClientId) -> anyhow::Result<&BalancerMonolith> {
        let monolith_id = self.find_monolith_id(client)?;
        let monolith = self
            .monoliths
            .get(&monolith_id)
            .ok_or(anyhow::anyhow!("monolith not found"))?;
        Ok(monolith)
    }

    pub fn find_monolith_mut(&mut self, client: ClientId) -> anyhow::Result<&mut BalancerMonolith> {
        let monolith_id = self.find_monolith_id(client)?;
        let monolith = self
            .monoliths
            .get_mut(&monolith_id)
            .ok_or(anyhow::anyhow!("monolith not found"))?;
        Ok(monolith)
    }

    /// When loading a room, call this to select the best monolith to load it on.
    pub fn select_monolith(&self) -> anyhow::Result<&BalancerMonolith> {
        let selected = self
            .monoliths
            .values()
            .min_by(|x, y| x.rooms().len().cmp(&y.rooms().len()));
        match selected {
            Some(s) => Ok(s),
            None => anyhow::bail!("no monoliths available"),
        }
    }

    pub fn random_monolith(&self) -> anyhow::Result<&BalancerMonolith> {
        let selected = self
            .monoliths
            .values()
            .choose(&mut rand::thread_rng())
            .ok_or(anyhow::anyhow!("no monoliths available"))?;
        Ok(selected)
    }
}

pub async fn join_client(
    ctx: Arc<RwLock<BalancerContext>>,
    new_client: NewClient,
    receiver_tx: tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
) -> anyhow::Result<()> {
    info!("new client: {:?}", new_client);

    let (client_tx, client_rx) = tokio::sync::mpsc::channel(100);
    let client = BalancerClient::new(new_client, client_tx);
    receiver_tx
        .send(client_rx)
        .map_err(|_| anyhow::anyhow!("receiver closed"))?;

    let ctx_read = ctx.read().await;
    let monolith_id = match ctx_read.rooms_to_monoliths.get(&client.room) {
        Some(id) => {
            // the room is already loaded
            *id
        }
        None => {
            // the room is not loaded, randomly select a monolith
            let selected = ctx_read.select_monolith()?;
            selected.id()
        }
    };
    drop(ctx_read);

    let mut b = ctx.write().await;
    b.add_room(client.room.clone(), monolith_id)?;
    b.add_client(client, monolith_id).await?;
    Ok(())
}

pub async fn leave_client(ctx: Arc<RwLock<BalancerContext>>, id: ClientId) -> anyhow::Result<()> {
    // todo!("inform the monolith that the client left");
    info!("client left: {:?}", id);
    ctx.write().await.remove_client(id)?;

    Ok(())
}

pub async fn dispatch_client_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<ClientId, SocketMessage>,
) -> anyhow::Result<()> {
    trace!("client message: {:?}", msg);

    match msg.message().0 {
        Message::Text(_) | Message::Binary(_) => {
            let raw_value: Box<RawValue> = msg.message().deserialize()?;

            let ctx_read = ctx.read().await;
            let Ok(monolith) = ctx_read.find_monolith(*msg.id()) else {
                anyhow::bail!("monolith not found");
            };

            monolith
                .send(&MsgB2M::ClientMsg {
                    client_id: *msg.id(),
                    payload: raw_value,
                })
                .await?;
        }
        Message::Close(_) => {
            leave_client(ctx, *msg.id()).await?;
            return Ok(());
        }
        _ => {}
    }

    Ok(())
}

pub async fn join_monolith(
    ctx: Arc<RwLock<BalancerContext>>,
    monolith: NewMonolith,
    receiver_tx: tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
) -> anyhow::Result<()> {
    info!("new monolith: {:?}", monolith);
    let mut b = ctx.write().await;
    let (monolith_tx, monolith_rx) = tokio::sync::mpsc::channel(100);
    let monolith = BalancerMonolith::new(monolith, monolith_tx);
    receiver_tx
        .send(monolith_rx)
        .map_err(|_| anyhow::anyhow!("receiver closed"))?;
    b.add_monolith(monolith);
    Ok(())
}

pub async fn dispatch_monolith_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<MonolithId, SocketMessage>,
) -> anyhow::Result<()> {
    trace!("monolith message: {:?}", msg);

    let monolith_id = msg.id();

    let msg: MsgM2B = msg.message().deserialize()?;

    debug!("got message from monolith: {:?}", msg);

    match msg {
        MsgM2B::Loaded { room } => {
            let mut ctx_write = ctx.write().await;
            ctx_write
                .rooms_to_monoliths
                .insert(room.clone(), *monolith_id);
            ctx_write
                .monoliths
                .get_mut(monolith_id)
                .unwrap()
                .add_room(Room::new(room));
        }
        MsgM2B::Unloaded { room } => {
            let mut ctx_write = ctx.write().await;
            ctx_write.rooms_to_monoliths.remove(&room);
            ctx_write
                .monoliths
                .get_mut(monolith_id)
                .unwrap()
                .remove_room(room);
        }
        MsgM2B::Gossip { rooms: _ } => todo!(),
        MsgM2B::RoomMsg {
            room,
            client_id: _,
            payload,
        } => {
            let ctx_read = ctx.read().await;

            let Some(room) = ctx_read
                .monoliths
                .get(monolith_id)
                .unwrap()
                .rooms()
                .get(&room) else {
                    anyhow::bail!("room not found on monolith");
                };

            // TODO: also handle the case where the client_id is Some

            // broadcast to all clients
            debug!("broadcasting to clients in room: {:?}", room.name());
            // TODO: optimize this using a broadcast channel
            let built_msg = SocketMessage(Message::text(payload.to_string()));
            for client in room.clients() {
                let Some(client) = ctx_read.clients.get(client) else {
                    anyhow::bail!("client not found");
                };

                client.send(built_msg.clone()).await?;
            }
        }
    }

    Ok(())
}
