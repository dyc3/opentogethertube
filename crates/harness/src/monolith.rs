use std::{
    collections::HashMap,
    net::{IpAddr, Ipv6Addr, SocketAddr},
    pin::Pin,
    sync::{Arc, Mutex},
};

use bytes::Bytes;
use futures_util::{Future, SinkExt, StreamExt};
use http_body_util::{BodyExt, Full};
use hyper::{body::Incoming as IncomingBody, Request};
use hyper::{service::Service, Response};

use ott_balancer_protocol::monolith::*;
use tokio::{net::TcpListener, sync::Notify};
use tracing::warn;
use tungstenite::Message;

use crate::{TestRunner, WebsocketSender};

pub struct Monolith {
    pub(crate) listener: Arc<TcpListener>,
    pub(crate) http_listener: Arc<TcpListener>,

    pub(crate) task: tokio::task::JoinHandle<()>,
    pub(crate) http_task: tokio::task::JoinHandle<()>,
    pub(crate) outgoing_tx: tokio::sync::mpsc::Sender<Message>,

    monolith_add_tx: tokio::sync::mpsc::Sender<SocketAddr>,
    monolith_remove_tx: tokio::sync::mpsc::Sender<SocketAddr>,

    notif_connect: Arc<Notify>,
    notif_disconnect: Arc<Notify>,
    notif_recv: Arc<Notify>,

    state: Arc<Mutex<MonolithState>>,
}

/// The internal state of the emulated monolith, safe to share between tasks and threads.
///
/// This is necessary because the monolith is split into two tasks: one for the websocket
/// connection and one for the HTTP mock server.
#[derive(Debug, Default)]
pub(crate) struct MonolithState {
    connected: bool,
    received_raw: Vec<Message>,
    received_http: Vec<MockRequest>,
    /// A mapping from request path to response body for mocking HTTP responses.
    response_mocks: HashMap<String, (MockRespParts, Bytes)>,
}

impl Monolith {
    pub async fn new(ctx: &TestRunner) -> anyhow::Result<Self> {
        // Binding to port 0 will let the OS allocate a random port for us.
        let listener =
            Arc::new(TcpListener::bind(SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), 0)).await?);
        let http_listener =
            Arc::new(TcpListener::bind(SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), 0)).await?);
        let notif_connect = Arc::new(Notify::new());
        let notif_disconnect = Arc::new(Notify::new());
        let notif_recv = Arc::new(Notify::new());

        let (outgoing_tx, mut outgoing_rx) = tokio::sync::mpsc::channel(50);

        let state = Arc::new(Mutex::new(MonolithState {
            ..Default::default()
        }));

        let _listener = listener.clone();
        let _notif_connect = notif_connect.clone();
        let _notif_disconnect = notif_disconnect.clone();
        let _notif_recv = notif_recv.clone();
        let _state = state.clone();
        let http_port = http_listener.local_addr().unwrap().port();
        let task = tokio::task::Builder::new()
            .name("emulated monolith (websocket)")
            .spawn(async move {
                let state = _state;
                loop {
                    let (stream, _) = _listener.accept().await.unwrap();
                    let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                    let init = M2BInit { port: http_port };
                    let msg = serde_json::to_string(&MsgM2B::Init(init)).unwrap();
                    ws.send(Message::Text(msg)).await.unwrap();
                    state.lock().unwrap().connected = true;
                    _notif_connect.notify_one();
                    loop {
                        println!("monolith: waiting for message");
                        tokio::select! {
                            Some(msg) = outgoing_rx.recv() => {
                                ws.send(msg).await.unwrap();
                            }
                            Some(msg) = ws.next() => {
                                match msg {
                                    Ok(msg) => {
                                        println!("monolith: incoming msg: {}", msg);
                                        state.lock().unwrap().received_raw.push(msg);
                                        _notif_recv.notify_one();
                                    },
                                    Err(e) => {
                                        warn!("monolith: websocket error: {:?}", e);
                                        break;
                                    }
                                }
                            }
                            else => break,
                        }
                    }
                    state.lock().unwrap().connected = false;
                    _notif_disconnect.notify_one();
                }
            })?;

        let _http_listener = http_listener.clone();
        let service = MockService::new(state.clone());
        let http_task = tokio::task::Builder::new()
            .name("emulated monolith (http)")
            .spawn(async move {
                let http_listener = _http_listener;
                let service = service.clone();

                loop {
                    let (stream, _) = http_listener.accept().await.unwrap();
                    let stream = tokio::io::BufReader::new(stream);
                    let io = hyper_util::rt::TokioIo::new(stream);

                    let service = service.clone();
                    let conn =
                        hyper::server::conn::http1::Builder::new().serve_connection(io, service);

                    if let Err(err) = conn.await {
                        warn!("Error serving connection: {:?}", err);
                    }
                }
            })?;

        Ok(Self {
            listener,
            http_listener,
            outgoing_tx,
            task,
            http_task,
            monolith_add_tx: ctx.monolith_add_tx.clone(),
            monolith_remove_tx: ctx.monolith_remove_tx.clone(),
            notif_connect,
            notif_disconnect,
            notif_recv,
            state,
        })
    }

    /// The port that balancer websocket connections should connect to.
    pub fn balancer_port(&self) -> u16 {
        self.listener.local_addr().unwrap().port()
    }

    /// The port that HTTP requests should be sent to.
    pub fn http_port(&self) -> u16 {
        self.http_listener.local_addr().unwrap().port()
    }

    pub fn connected(&self) -> bool {
        self.state.lock().unwrap().connected
    }

    /// Tell the provider to add this monolith to the list of available monoliths.
    pub async fn show(&mut self) {
        println!("showing monolith");
        self.monolith_add_tx
            .send(self.listener.local_addr().unwrap())
            .await
            .unwrap();
        println!("waiting for notification");
        self.notif_connect.notified().await;
    }

    /// Tell the provider to remove this monolith from the list of available monoliths.
    pub async fn hide(&mut self) {
        println!("hiding monolith");
        self.monolith_remove_tx
            .send(self.listener.local_addr().unwrap())
            .await
            .unwrap();
        println!("waiting for notification");
        self.notif_disconnect.notified().await;
    }

    /// Wait until the next message is received.
    pub async fn wait_recv(&self) {
        self.notif_recv.notified().await;
    }

    pub fn clear_recv(&mut self) {
        self.state.lock().unwrap().received_raw.clear();
    }

    pub async fn send(&mut self, msg: impl Into<MsgM2B>) {
        let msg = serde_json::to_string(&msg.into()).unwrap();
        self.send_raw(Message::Text(msg)).await;
    }

    pub fn collect_recv(&self) -> Vec<MsgB2M> {
        self.state
            .lock()
            .unwrap()
            .received_raw
            .iter()
            .filter_map(|msg| match msg {
                Message::Text(msg) => {
                    let msg: MsgB2M = serde_json::from_str(msg).unwrap();
                    Some(msg)
                }
                _ => None,
            })
            .collect()
    }

    /// Set a mock HTTP response for the given path.
    pub fn mock_http_raw(&mut self, path: impl Into<String>, parts: MockRespParts, body: Bytes) {
        self.state
            .lock()
            .unwrap()
            .response_mocks
            .insert(path.into(), (parts, body));
    }

    pub fn mock_http_json(
        &mut self,
        path: impl Into<String>,
        parts: MockRespParts,
        body: impl serde::Serialize,
    ) {
        let body = serde_json::to_vec(&body).unwrap();
        self.mock_http_raw(path, parts, body.into())
    }

    pub fn collect_mock_http(&self) -> Vec<MockRequest> {
        self.state.lock().unwrap().received_http.clone()
    }
}

impl Drop for Monolith {
    fn drop(&mut self) {
        self.task.abort();
        self.http_task.abort();
    }
}

#[async_trait::async_trait]
impl WebsocketSender for Monolith {
    async fn send_raw(&mut self, msg: Message) {
        self.outgoing_tx.try_send(msg).unwrap();
    }
}

/// A mock HTTP service that can be used to mock HTTP responses for emulated monoliths.
#[derive(Debug, Clone)]
struct MockService {
    state: Arc<Mutex<MonolithState>>,
}

impl MockService {
    pub fn new(state: Arc<Mutex<MonolithState>>) -> Self {
        Self { state }
    }
}

impl Service<Request<IncomingBody>> for MockService {
    type Response = Response<Full<Bytes>>;
    type Error = hyper::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn call(&self, req: Request<hyper::body::Incoming>) -> Self::Future {
        let state = self.state.clone();
        Box::pin(async move {
            let (parts, body) = req.into_parts();
            let path = parts.uri.path().to_owned();

            let req_body = body
                .collect()
                .await
                .expect("failed to read request body")
                .to_bytes();
            let mut state = state.lock().unwrap();
            state.received_http.push(MockRequest {
                version: parts.version,
                method: parts.method,
                uri: parts.uri,
                headers: parts.headers,
                body: req_body,
            });

            let resp = state.response_mocks.get(&path).cloned();
            match resp {
                Some((parts, bytes)) => {
                    let mut resp = Response::builder()
                        .version(parts.version)
                        .status(parts.status);
                    let resp_headers = resp.headers_mut().unwrap();
                    *resp_headers = parts.headers;
                    Ok(resp
                        .body(Full::new(bytes))
                        .expect("failed to build mock response"))
                }
                None => Ok(Response::new(Full::new(Bytes::from(format!(
                    "mock not found: {}",
                    path
                ))))),
            }
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct MockRespParts {
    pub status: hyper::StatusCode,
    pub version: hyper::Version,
    pub headers: hyper::HeaderMap,
}

#[derive(Debug, Clone, Default)]
pub struct MockRequest {
    pub version: hyper::Version,
    pub method: hyper::Method,
    pub uri: hyper::Uri,
    pub headers: hyper::HeaderMap,
    pub body: Bytes,
}
