// goal: ONE TASK PER SOCKET MESSAGE

use std::{collections::HashMap, sync::Arc};

use rocket_ws as ws;
use tokio::sync::RwLock;

use crate::{
    client::{BalancerClient, NewClient},
    messages::*,
    monolith::{BalancerMonolith, NewMonolith},
};

pub struct Balancer {
    ctx: Arc<RwLock<BalancerContext>>,

    new_client_rx: tokio::sync::mpsc::Receiver<NewClient>,
    new_client_tx: tokio::sync::mpsc::Sender<NewClient>,

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
                    if let Some(new_client) = new_client {
                        join_client(self.ctx.clone(), new_client).await;
                    }
                }
                msg = self.client_msg_rx.recv() => {
                    if let Some(msg) = msg {
                        dispatch_client_message(self.ctx.clone(), msg).await;
                    }
                }
                new_monolith = self.new_monolith_rx.recv() => {
                    if let Some((new_monolith, receiver_tx)) = new_monolith {
                        join_monolith(self.ctx.clone(), new_monolith, receiver_tx).await;
                    }
                }
                msg = self.monolith_msg_rx.recv() => {
                    if let Some(msg) = msg {
                        dispatch_monolith_message(self.ctx.clone(), msg).await;
                    }
                }
            }
        }
    }
}

pub fn start_dispatcher(mut balancer: Balancer) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        balancer.dispatch_loop().await;
    })
}

pub struct BalancerLink {
    new_client_tx: tokio::sync::mpsc::Sender<NewClient>,
    client_msg_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,

    new_monolith_tx: tokio::sync::mpsc::Sender<(
        NewMonolith,
        tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
    )>,
    monolith_msg_tx: tokio::sync::mpsc::Sender<Context<MonolithId, SocketMessage>>,
}

impl BalancerLink {
    pub async fn send_client(&self, client: NewClient) -> anyhow::Result<()> {
        self.new_client_tx.send(client).await?;
        Ok(())
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

    pub fn add_client(&mut self, client: NewClient) {
        let client = BalancerClient::new(client);
        self.clients.insert(client.id, client);
    }

    pub fn remove_client(&mut self, client_id: ClientId) {
        self.clients.remove(&client_id);
    }

    pub fn add_monolith(&mut self, monolith: BalancerMonolith) {
        self.monoliths.insert(monolith.id(), monolith);
    }

    pub fn remove_monolith(&mut self, monolith_id: MonolithId) {
        self.monoliths.remove(&monolith_id);
    }
}

pub async fn join_client(
    ctx: Arc<RwLock<BalancerContext>>,
    client: NewClient,
) -> anyhow::Result<()> {
    println!("new client: {:?}", client);
    let mut b = ctx.write().await;
    b.add_client(client);
    // todo!("load the room if its not loaded");
    // todo!("inform the monolith that the client joined");

    Ok(())
}

pub async fn leave_client(ctx: Arc<RwLock<BalancerContext>>, id: ClientId) -> anyhow::Result<()> {
    // todo!("inform the monolith that the client left");
    println!("client left: {:?}", id);
    ctx.write().await.remove_client(id);

    Ok(())
}

pub async fn dispatch_client_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<ClientId, SocketMessage>,
) -> anyhow::Result<()> {
    // todo!("route the message to the correct monotlith");
    println!("client message: {:?}", msg);

    Ok(())
}

pub async fn join_monolith(
    ctx: Arc<RwLock<BalancerContext>>,
    monolith: NewMonolith,
    receiver_tx: tokio::sync::oneshot::Sender<tokio::sync::mpsc::Receiver<SocketMessage>>,
) -> anyhow::Result<()> {
    println!("new monolith: {:?}", monolith);
    let mut b = ctx.write().await;
    let (monolith_tx, monolith_rx) = tokio::sync::mpsc::channel(100);
    let monolith = BalancerMonolith::new(monolith, monolith_tx);
    receiver_tx.send(monolith_rx);
    b.add_monolith(monolith);
    Ok(())
}

pub async fn dispatch_monolith_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<MonolithId, SocketMessage>,
) -> anyhow::Result<()> {
    println!("monolith message: {:?}", msg);
    // todo!("route the message to the correct clients");

    Ok(())
}
