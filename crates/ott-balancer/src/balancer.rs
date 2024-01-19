use std::{collections::HashMap, sync::Arc};

use ott_balancer_protocol::monolith::{
    B2MClientMsg, B2MJoin, B2MLeave, B2MUnload, MsgB2M, MsgM2B, RoomMetadata,
};
use ott_balancer_protocol::*;
use rand::seq::IteratorRandom;
use serde_json::value::RawValue;
use tokio::sync::RwLock;
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, instrument, trace, warn};

use crate::client::ClientLink;
use crate::config::BalancerConfig;
use crate::monolith::Room;
use crate::room::RoomLocator;
use crate::{
    client::{BalancerClient, NewClient},
    messages::*,
    monolith::{BalancerMonolith, NewMonolith},
};

pub struct Balancer {
    pub(crate) ctx: Arc<RwLock<BalancerContext>>,

    new_client_rx:
        tokio::sync::mpsc::Receiver<(NewClient, tokio::sync::oneshot::Sender<ClientLink>)>,
    new_client_tx: tokio::sync::mpsc::Sender<(NewClient, tokio::sync::oneshot::Sender<ClientLink>)>,

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

        let (new_monolith_tx, new_monolith_rx) = tokio::sync::mpsc::channel(20);
        let (monolith_msg_tx, monolith_msg_rx) = tokio::sync::mpsc::channel(100);

        Self {
            ctx,

            new_client_rx,
            new_client_tx,

            new_monolith_rx,
            new_monolith_tx,

            monolith_msg_rx,
            monolith_msg_tx,
        }
    }

    pub fn new_link(&self) -> BalancerLink {
        BalancerLink {
            new_client_tx: self.new_client_tx.clone(),

            new_monolith_tx: self.new_monolith_tx.clone(),
            monolith_msg_tx: self.monolith_msg_tx.clone(),
        }
    }

    pub async fn dispatch_loop(&mut self) {
        loop {
            tokio::select! {
                new_client = self.new_client_rx.recv() => {
                    if let Some((new_client, client_link_tx)) = new_client {
                        let ctx = self.ctx.clone();
                        let _ = tokio::task::Builder::new().name("join client").spawn(async move {
                            match join_client(ctx, new_client, client_link_tx).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to join client: {:?}", err)
                            };
                        });
                    } else {
                        warn!("new client channel closed")
                    }
                }
                new_monolith = self.new_monolith_rx.recv() => {
                    if let Some((new_monolith, receiver_tx)) = new_monolith {
                        let ctx = self.ctx.clone();
                        let _ = tokio::task::Builder::new().name("join monolith").spawn(async move {
                            match join_monolith(ctx, new_monolith, receiver_tx).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to join monolith: {:?}", err)
                            }
                        });
                    } else {
                        warn!("new monolith channel closed")
                    }
                }
                msg = self.monolith_msg_rx.recv() => {
                    if let Some(msg) = msg {
                        let ctx = self.ctx.clone();
                        let _ = tokio::task::Builder::new().name("dispatch monolith message").spawn(async move {
                            let id = *msg.id();
                            match dispatch_monolith_message(ctx, msg).await {
                                Ok(_) => {},
                                Err(err) => error!("failed to dispatch monolith message {}: {:?}", id, err)
                            }
                        });
                    } else {
                        warn!("monolith message channel closed")
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
    new_client_tx: tokio::sync::mpsc::Sender<(NewClient, tokio::sync::oneshot::Sender<ClientLink>)>,

    new_monolith_tx: tokio::sync::mpsc::Sender<(
        NewMonolith,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,
    monolith_msg_tx: tokio::sync::mpsc::Sender<Context<MonolithId, SocketMessage>>,
}

impl BalancerLink {
    pub async fn send_client(&self, client: NewClient) -> anyhow::Result<ClientLink> {
        let (receiver_tx, receiver_rx) = tokio::sync::oneshot::channel();
        self.new_client_tx.send((client, receiver_tx)).await?;
        let client_link = receiver_rx.await?;

        Ok(client_link)
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

#[derive(Debug, Default)]
pub struct BalancerContext {
    pub clients: HashMap<ClientId, BalancerClient>,
    pub monoliths: HashMap<MonolithId, BalancerMonolith>,
    pub rooms_to_monoliths: HashMap<RoomName, RoomLocator>,
    pub monoliths_by_region: HashMap<String, Vec<MonolithId>>,
}

pub struct MonolithRegistry {
    pub monoliths_by_region: HashMap<String, Vec<MonolithId>>,
    pub monoliths: HashMap<MonolithId, BalancerMonolith>,
}

pub trait MonolithSelection {
    
    fn select_monolith(&self) -> anyhow::Result<&BalancerMonolith>;

    fn random_monolith(&self) -> anyhow::Result<&BalancerMonolith>;
}

impl MonolithSelection for MonolithRegistry {
    fn select_monolith(&self) -> anyhow::Result<&BalancerMonolith> {
        fn cmp(x: &BalancerMonolith, y: &BalancerMonolith) -> std::cmp::Ordering {
            x.rooms().len().cmp(&y.rooms().len())
        }

        let in_region = self
            .monoliths_by_region
            .get(BalancerConfig::get().region.as_str());
        if let Some(in_region) = in_region {
            let selected = in_region
                .iter()
                .flat_map(|id| self.monoliths.get(id))
                .min_by(|x, y| cmp(x, y));
            if let Some(s) = selected {
                return Ok(s);
            }
        }
        let selected = self.monoliths.values().min_by(|x, y| cmp(x, y));
        match selected {
            Some(s) => Ok(s),
            None => anyhow::bail!("no monoliths available"),
        }
    }

    fn random_monolith(&self) -> anyhow::Result<&BalancerMonolith> {
        let in_region = self
            .monoliths_by_region
            .get(BalancerConfig::get().region.as_str());
        if let Some(in_region) = in_region {
            let selected = in_region.iter().choose(&mut rand::thread_rng());
            if let Some(s) = selected {
                if let Some(m) = self.monoliths.get(s) {
                    return Ok(m);
                }
            }
        }

        let selected = self
            .monoliths
            .values()
            .choose(&mut rand::thread_rng())
            .ok_or(anyhow::anyhow!("no monoliths available"))?;
        Ok(selected)
    }
}

impl BalancerContext {
    pub fn new() -> Self {
        Default::default()
    }

    #[instrument(skip(self, client), err, fields(client_id = %client.id, room = %client.room))]
    pub async fn add_client(
        &mut self,
        client: BalancerClient,
        monolith_id: MonolithId,
    ) -> anyhow::Result<()> {
        info!("adding client to monolith");
        let Some(monolith) = self.monoliths.get_mut(&monolith_id) else {
            anyhow::bail!("monolith not found");
        };
        monolith.add_client(&client.room, client.id);
        monolith
            .send(B2MJoin {
                room: client.room.clone(),
                client: client.id,
                token: client.token.clone(),
            })
            .await?;
        self.clients.insert(client.id, client);

        Ok(())
    }

    #[instrument(skip(self), err)]
    pub async fn remove_client(&mut self, client_id: ClientId) -> anyhow::Result<()> {
        let monolith = self.find_monolith_mut(client_id)?;
        monolith.remove_client(client_id);
        monolith.send(B2MLeave { client: client_id }).await?;
        self.clients.remove(&client_id);

        Ok(())
    }

    pub fn add_monolith(&mut self, monolith: BalancerMonolith) {
        let id = monolith.id();
        let region = monolith.region().to_string();
        self.monoliths.insert(id, monolith);
        self.monoliths_by_region.entry(region).or_default().push(id);
    }

    pub async fn remove_monolith(&mut self, monolith_id: MonolithId) -> anyhow::Result<()> {
        let m = self.monoliths.remove(&monolith_id);
        if let Some(m) = m {
            let region = m.region().to_string();
            self.monoliths_by_region.entry(region).and_modify(|v| {
                v.retain(|x| *x != monolith_id);
            });
        }

        self.rooms_to_monoliths
            .retain(|_, v| v.monolith_id() != monolith_id);

        self.clients
            .retain(|_, v| self.rooms_to_monoliths.contains_key(&v.room));

        for client in self.clients.values() {
            match client
                .send(Message::Close(Some(CloseFrame {
                    code: CloseCode::Away,
                    reason: "Monolith disconnect".into(),
                })))
                .await
            {
                Ok(()) => {}
                Err(err) => {
                    error!("failed to disconnect client: {:?}", err)
                }
            };
        }

        Ok(())
    }

    #[instrument(skip(self, room_name), fields(room = %room_name, load_epoch = %locator.load_epoch()))]
    pub fn add_room(&mut self, room_name: RoomName, locator: RoomLocator) -> anyhow::Result<&Room> {
        debug!("add_room");
        let monolith = self
            .monoliths
            .get_mut(&locator.monolith_id())
            .ok_or(anyhow::anyhow!("monolith not found"))?;
        self.rooms_to_monoliths.insert(room_name.clone(), locator);
        let room = monolith.add_room(&room_name)?;
        Ok(room)
    }

    pub async fn remove_room(
        &mut self,
        room: &RoomName,
        monolith_id: MonolithId,
    ) -> anyhow::Result<()> {
        debug!(func = "remove_room", %room, %monolith_id);
        let monolith = self
            .monoliths
            .get_mut(&monolith_id)
            .ok_or(anyhow::anyhow!("monolith not found"))?;
        self.rooms_to_monoliths.remove(room);
        let room = monolith.remove_room(room);
        if let Some(room) = room {
            for client_id in room.clients() {
                self.clients
                    .get(client_id)
                    .unwrap()
                    .send(Message::Close(Some(CloseFrame {
                        code: CloseCode::Again,
                        reason: "Room unloaded".into(),
                    })))
                    .await?;
            }
        }
        Ok(())
    }

    #[instrument(skip(self, metadata), err, fields(room = %metadata.name))]
    pub async fn add_or_sync_room(
        &mut self,
        metadata: RoomMetadata,
        monolith_id: MonolithId,
        load_epoch: u32,
    ) -> anyhow::Result<()> {
        debug!(func = "add_or_sync_room");
        if let Some(locator) = self.rooms_to_monoliths.get(&metadata.name) {
            if locator.monolith_id() != monolith_id {
                // this room is loaded on a different monolith than we were expecting
                match locator.load_epoch().cmp(&load_epoch) {
                    std::cmp::Ordering::Less => {
                        // we already have an older version of this room
                        self.unload_room(monolith_id, metadata.name.clone()).await?;
                        return Err(anyhow::anyhow!("room already loaded"));
                    }
                    std::cmp::Ordering::Greater => {
                        // we have an newer version of this room, remove it
                        self.unload_room(locator.monolith_id(), metadata.name.clone())
                            .await?;
                        // self.remove_room(&metadata.name, locator.monolith_id())
                        //     .await?;
                    }
                    _ => {}
                }
            }
        }
        let monolith = self.monoliths.get_mut(&monolith_id).unwrap();

        self.rooms_to_monoliths.insert(
            metadata.name.clone(),
            RoomLocator::new(monolith_id, load_epoch),
        );
        monolith.add_or_sync_room(metadata)?;

        Ok(())
    }

    pub fn find_monolith_id(&self, client: ClientId) -> anyhow::Result<MonolithId> {
        let client = self
            .clients
            .get(&client)
            .ok_or(anyhow::anyhow!("client not found"))?;
        let locator = self
            .rooms_to_monoliths
            .get(&client.room)
            .ok_or(anyhow::anyhow!("room not found in rooms_to_monoliths"))?;
        Ok(locator.monolith_id())
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
        fn cmp(x: &BalancerMonolith, y: &BalancerMonolith) -> std::cmp::Ordering {
            x.rooms().len().cmp(&y.rooms().len())
        }

        let in_region = self
            .monoliths_by_region
            .get(BalancerConfig::get().region.as_str());
        if let Some(in_region) = in_region {
            let selected = in_region
                .iter()
                .flat_map(|id| self.monoliths.get(id))
                .min_by(|x, y| cmp(x, y));
            if let Some(s) = selected {
                return Ok(s);
            }
        }
        let selected = self.monoliths.values().min_by(|x, y| cmp(x, y));
        match selected {
            Some(s) => Ok(s),
            None => anyhow::bail!("no monoliths available"),
        }
    }

    pub fn random_monolith(&self) -> anyhow::Result<&BalancerMonolith> {
        let in_region = self
            .monoliths_by_region
            .get(BalancerConfig::get().region.as_str());
        if let Some(in_region) = in_region {
            let selected = in_region.iter().choose(&mut rand::thread_rng());
            if let Some(s) = selected {
                if let Some(m) = self.monoliths.get(s) {
                    return Ok(m);
                }
            }
        }

        let selected = self
            .monoliths
            .values()
            .choose(&mut rand::thread_rng())
            .ok_or(anyhow::anyhow!("no monoliths available"))?;
        Ok(selected)
    }

    #[instrument(skip(self, monolith), err, fields(monolith_id = %monolith))]
    pub async fn unload_room(&self, monolith: MonolithId, room: RoomName) -> anyhow::Result<()> {
        debug!(func = "unload_room", %room, monolith_id = %monolith);
        let monolith = self.monoliths.get(&monolith).unwrap();
        monolith.send(B2MUnload { room }).await?;
        Ok(())
    }
}

#[instrument(skip_all, err, fields(client_id = %new_client.id, room = %new_client.room))]
pub async fn join_client(
    ctx: Arc<RwLock<BalancerContext>>,
    new_client: NewClient,
    client_link_tx: tokio::sync::oneshot::Sender<ClientLink>,
) -> anyhow::Result<()> {
    info!("new client");

    // since we're always going to be doing a write, we can just lock the context for the whole function so it doesn't change out from under us
    let mut ctx_write = ctx.write().await;

    let (monolith_id, should_create_room) = match ctx_write.rooms_to_monoliths.get(&new_client.room)
    {
        Some(locator) => {
            debug!("room already loaded on {}", locator.monolith_id());
            (locator.monolith_id(), false)
        }
        None => {
            // the room is not loaded, randomly select a monolith
            let selected = ctx_write.select_monolith()?;
            debug!(
                "room is not loaded, selected monolith: {:?} (region: {:?})",
                selected.id(),
                selected.region()
            );
            (selected.id(), true)
        }
    };

    let room_broadcast_rx = if should_create_room {
        // we assume the load epoch is u32::MAX since we're creating the room. this will be updated when the monolith sends us the loaded message, or when we receive the gossip message
        ctx_write.add_room(
            new_client.room.clone(),
            RoomLocator::new(monolith_id, u32::MAX),
        )?
    } else {
        let monolith = ctx_write.monoliths.get(&monolith_id).unwrap();
        let room = monolith.rooms().get(&new_client.room).unwrap();
        room
    }
    .new_broadcast_rx();

    let monolith = ctx_write.monoliths.get(&monolith_id).unwrap();
    let client_inbound_tx = monolith.new_inbound_tx();

    let (client_outbound_unicast_tx, client_outbound_unicast_rx) = tokio::sync::mpsc::channel(100);

    let link = ClientLink::new(
        new_client.id,
        client_inbound_tx,
        room_broadcast_rx,
        client_outbound_unicast_rx,
    );
    let client = BalancerClient::new(new_client, client_outbound_unicast_tx);
    client_link_tx
        .send(link)
        .map_err(|_| anyhow::anyhow!("receiver closed"))?;

    ctx_write.add_client(client, monolith_id).await?;
    Ok(())
}

#[instrument(skip_all, err, fields(client_id = %id))]
pub async fn leave_client(ctx: Arc<RwLock<BalancerContext>>, id: ClientId) -> anyhow::Result<()> {
    info!("client left");
    ctx.write().await.remove_client(id).await?;

    Ok(())
}

#[instrument(skip_all, err, fields(monolith_id = %monolith.id))]
pub async fn join_monolith(
    ctx: Arc<RwLock<BalancerContext>>,
    monolith: NewMonolith,
    receiver_tx: tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
) -> anyhow::Result<()> {
    info!("new monolith");
    let mut b = ctx.write().await;
    let (client_inbound_tx, mut client_inbound_rx) = tokio::sync::mpsc::channel(100);
    let (monolith_outbound_tx, monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
    let monolith_outbound_tx = Arc::new(monolith_outbound_tx);
    let monolith = BalancerMonolith::new(monolith, monolith_outbound_tx.clone(), client_inbound_tx);
    receiver_tx
        .send(monolith_outbound_rx)
        .map_err(|_| anyhow::anyhow!("receiver closed"))?;
    let monolith_id = monolith.id();
    b.add_monolith(monolith);
    drop(b);

    let ctx = ctx.clone();
    let monolith_outbound_tx = monolith_outbound_tx.clone();
    tokio::task::Builder::new()
        .name(format!("monolith {}", monolith_id).as_ref())
        .spawn(async move {
            while let Some(msg) = client_inbound_rx.recv().await {
                if let Err(e) =
                    handle_client_inbound(ctx.clone(), msg, monolith_outbound_tx.clone()).await
                {
                    error!("failed to handle client inbound: {:?}", e);
                    if monolith_outbound_tx.is_closed() {
                        // the monolith has disconnected
                        info!("monolith disconnected, stopping client inbound handler");
                        break;
                    }
                }
            }
        })?;
    Ok(())
}

async fn handle_client_inbound(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<ClientId, SocketMessage>,
    monolith_outbound_tx: Arc<tokio::sync::mpsc::Sender<SocketMessage>>,
) -> anyhow::Result<()> {
    match msg.message() {
        SocketMessage::Message(Message::Text(_) | Message::Binary(_)) => {
            let raw_value: Box<RawValue> = msg.message().deserialize()?;

            let built_msg: MsgB2M = B2MClientMsg {
                client_id: *msg.id(),
                payload: raw_value,
            }
            .into();
            let text = serde_json::to_string(&built_msg).expect("failed to serialize message");
            let socket_msg = Message::Text(text).into();
            monolith_outbound_tx.send(socket_msg).await?;
        }
        #[allow(deprecated)]
        SocketMessage::Message(Message::Close(_)) | SocketMessage::End => {
            leave_client(ctx, *msg.id()).await?;
        }
        SocketMessage::Message(Message::Frame(_)) => unreachable!(),
        _ => {}
    }
    Ok(())
}

#[instrument(skip_all, err, fields(monolith_id = %id))]
pub async fn leave_monolith(
    ctx: Arc<RwLock<BalancerContext>>,
    id: MonolithId,
) -> anyhow::Result<()> {
    info!("monolith left");
    let mut ctx_write = ctx.write().await;
    ctx_write.remove_monolith(id).await?;
    Ok(())
}

pub async fn dispatch_monolith_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<MonolithId, SocketMessage>,
) -> anyhow::Result<()> {
    trace!("monolith message: {:?}", msg);

    let monolith_id = msg.id();

    match msg.message() {
        SocketMessage::Message(Message::Text(_) | Message::Binary(_)) => {
            let msg: MsgM2B = msg.message().deserialize()?;

            debug!("got message from monolith: {:?}", msg);

            match msg {
                MsgM2B::Init(_) => {
                    warn!(
                        "monolith {:?} sent init when it wasn't expected, ignoring",
                        monolith_id
                    );
                }
                MsgM2B::Loaded(msg) => {
                    debug!("room loaded on {}: {:?}", monolith_id, msg.room.name);
                    let mut ctx_write = ctx.write().await;
                    ctx_write
                        .add_or_sync_room(msg.room, *monolith_id, msg.load_epoch)
                        .await?;
                }
                MsgM2B::Unloaded(msg) => {
                    let mut ctx_write = ctx.write().await;
                    ctx_write.remove_room(&msg.name, *monolith_id).await?;
                }
                MsgM2B::Gossip(msg) => {
                    let mut ctx_write = ctx.write_owned().await;
                    let to_remove = ctx_write
                        .monoliths
                        .get_mut(monolith_id)
                        .unwrap()
                        .rooms()
                        .keys()
                        .filter(|room| !msg.rooms.iter().any(|r| r.room.name == **room))
                        .cloned()
                        .collect::<Vec<_>>();
                    debug!("to_remove: {:?}", to_remove);
                    for gossip_room in msg.rooms {
                        let room_name = gossip_room.room.name.clone();
                        match ctx_write
                            .add_or_sync_room(
                                gossip_room.room,
                                *monolith_id,
                                gossip_room.load_epoch,
                            )
                            .await
                        {
                            Ok(_) => {}
                            Err(err) => {
                                warn!("failed to add room: {:?}", err);
                                let _ = ctx_write.remove_room(&room_name, *monolith_id).await;
                            }
                        }
                    }

                    for room in to_remove {
                        let _ = ctx_write.remove_room(&room, *monolith_id).await;
                    }
                }
                MsgM2B::RoomMsg(msg) => {
                    let ctx_read = ctx.read().await;

                    let Some(room) = ctx_read
                        .monoliths
                        .get(monolith_id)
                        .unwrap()
                        .rooms()
                        .get(&msg.room)
                    else {
                        anyhow::bail!("room not found on monolith");
                    };

                    let built_msg = Message::text(msg.payload.to_string());

                    match &msg.client_id {
                        Some(client) => {
                            let Some(client) = ctx_read.clients.get(client) else {
                                anyhow::bail!("client not found");
                            };
                            client.send(built_msg).await?;
                        }
                        None => {
                            // broadcast to all clients
                            debug!("broadcasting to clients in room: {:?}", room.name());
                            room.broadcast(built_msg)?;
                        }
                    }
                }
                MsgM2B::Kick(msg) => {
                    let ctx_read = ctx.read().await;
                    let Some(client) = ctx_read.clients.get(&msg.client_id) else {
                        anyhow::bail!("client not found");
                    };
                    client
                        .send(Message::Close(Some(CloseFrame {
                            code: CloseCode::Library(msg.reason),
                            reason: "".into(),
                        })))
                        .await?;
                }
            }
        }
        #[allow(deprecated)]
        SocketMessage::Message(Message::Close(_)) | SocketMessage::End => {
            leave_monolith(ctx, *monolith_id).await?;
        }
        SocketMessage::Message(Message::Frame(_)) => unreachable!(),
        _ => {}
    }

    Ok(())
}

#[cfg(test)]
mod test {
    use std::net::Ipv4Addr;

    use crate::discovery::{HostOrIp, MonolithConnectionConfig};

    use super::*;

    #[tokio::test]
    async fn test_clients_add_remove() {
        // a bunch of setup
        let room_name = RoomName::from("test");
        let mut ctx = BalancerContext::new();
        let (monolith_outbound_tx, _monolith_outbound_rx) = tokio::sync::mpsc::channel(100);
        let monolith_outbound_tx = Arc::new(monolith_outbound_tx);
        let (client_inbound_tx, _client_inbound_rx) = tokio::sync::mpsc::channel(100);
        let (client_unicast_tx, _client_unicast_rx) = tokio::sync::mpsc::channel(100);
        let monolith_id = uuid::Uuid::new_v4().into();
        let monolith = BalancerMonolith::new(
            NewMonolith {
                id: monolith_id,
                region: "unknown".into(),
                config: MonolithConnectionConfig {
                    host: HostOrIp::Ip(Ipv4Addr::LOCALHOST.into()),
                    port: 3002,
                },
                proxy_port: 3000,
            },
            monolith_outbound_tx,
            client_inbound_tx,
        );
        let client_id = uuid::Uuid::new_v4().into();
        let client = BalancerClient::new(
            NewClient {
                id: client_id,
                room: room_name.clone(),
                token: "test".into(),
            },
            client_unicast_tx,
        );
        ctx.add_monolith(monolith);
        ctx.add_room(room_name.clone(), RoomLocator::new(monolith_id, 0))
            .expect("failed to add room");

        // add a client
        ctx.add_client(client, monolith_id)
            .await
            .expect("failed to add client");

        // make sure the client is in the context
        assert!(ctx.clients.contains_key(&client_id));

        // make sure the client is in the monolith
        assert!(ctx
            .monoliths
            .get(&monolith_id)
            .unwrap()
            .rooms()
            .get(&room_name)
            .unwrap()
            .clients()
            .contains(&client_id));

        // remove the client
        ctx.remove_client(client_id)
            .await
            .expect("failed to remove client");

        // make sure the client is not in the context
        assert!(!ctx.clients.contains_key(&client_id));

        // make sure the client is not in the monolith
        assert!(!ctx
            .monoliths
            .get(&monolith_id)
            .unwrap()
            .rooms()
            .get(&room_name)
            .unwrap()
            .clients()
            .contains(&client_id));
    }
}
