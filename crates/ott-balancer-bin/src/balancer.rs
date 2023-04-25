// goal: ONE TASK PER SOCKET MESSAGE

use std::{collections::HashMap, sync::Arc};

use rocket_ws as ws;
use tokio::sync::RwLock;

use crate::{
    client::{BalancerClient, NewClient},
    messages::*,
    monolith::BalancerMonolith,
};

pub struct Balancer {
    ctx: Arc<RwLock<BalancerContext>>,

    new_client_rx: tokio::sync::mpsc::Receiver<NewClient>,
    new_client_tx: tokio::sync::mpsc::Sender<NewClient>,

    client_msg_rx: tokio::sync::mpsc::Receiver<Context<ClientId, SocketMessage>>,
    client_msg_tx: tokio::sync::mpsc::Sender<Context<ClientId, SocketMessage>>,
}

impl Balancer {
    pub fn new(ctx: Arc<RwLock<BalancerContext>>) -> Self {
        let (new_client_tx, new_client_rx) = tokio::sync::mpsc::channel(20);
        let (client_msg_tx, client_msg_rx) = tokio::sync::mpsc::channel(100);

        Self {
            ctx,

            new_client_rx,
            new_client_tx,

            client_msg_rx,
            client_msg_tx,
        }
    }

    pub fn new_link(&self) -> BalancerLink {
        BalancerLink {
            new_client_tx: self.new_client_tx.clone(),
            client_msg_tx: self.client_msg_tx.clone(),
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
                        todo!("handle client msg");
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
}

pub async fn join_client(
    ctx: Arc<RwLock<BalancerContext>>,
    client: NewClient,
) -> anyhow::Result<()> {
    todo!("add the client to the context");
    todo!("load the room if its not loaded");
    todo!("inform the monolith that the client joined");

    Ok(())
}

pub async fn leave_client(ctx: Arc<RwLock<BalancerContext>>, id: ClientId) -> anyhow::Result<()> {
    todo!("inform the monolith that the client left");
    ctx.write().await.remove_client(id);

    Ok(())
}

pub async fn dispatch_client_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<ClientId, SocketMessage>,
) -> anyhow::Result<()> {
    todo!("route the message to the correct monotlith");

    Ok(())
}

pub async fn dispatch_monolith_message(
    ctx: Arc<RwLock<BalancerContext>>,
    msg: Context<MonolithId, SocketMessage>,
) -> anyhow::Result<()> {
    todo!("route the message to the correct clients");

    Ok(())
}
