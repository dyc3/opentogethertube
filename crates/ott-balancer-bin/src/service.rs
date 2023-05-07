use std::pin::Pin;
use std::sync::Arc;

use futures_util::Future;
use http_body_util::Full;
use hyper::body::Bytes;
use hyper::service::Service;
use hyper::StatusCode;
use hyper::{body::Incoming as IncomingBody, Request, Response};
use once_cell::sync::Lazy;
use route_recognizer::Router;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

use crate::balancer::{BalancerContext, BalancerLink};
use crate::monolith::monolith_entry;

static NOTFOUND: &[u8] = b"Not Found";

static ROUTER: Lazy<Router<&'static str>> = Lazy::new(|| {
    let mut router = Router::new();
    router.add("/api/status", "health");
    router.add("/api/status/metrics", "metrics");
    router.add("/api/room/:room_name", "room");
    router.add("/monolith", "monolith");
    router.add("/*", "other");
    router
});

#[derive(Clone)]
pub struct BalancerService {
    pub(crate) ctx: Arc<RwLock<BalancerContext>>,
    pub(crate) link: BalancerLink,
}

#[async_trait::async_trait]
impl Service<Request<IncomingBody>> for BalancerService {
    type Response = Response<Full<Bytes>>;
    type Error = hyper::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn call(&mut self, req: Request<hyper::body::Incoming>) -> Self::Future {
        fn mk_response(s: String) -> anyhow::Result<Response<Full<Bytes>>, hyper::Error> {
            Ok(Response::builder().body(Full::new(Bytes::from(s))).unwrap())
        }

        let ctx: Arc<RwLock<BalancerContext>> = self.ctx.clone();
        let link = self.link.clone();

        Box::pin(async move {
            let ctx_read = ctx.read().await;
            let Ok(route) = ROUTER.recognize(req.uri().path()) else {
                return Ok(not_found());
            };
            info!(
                "Inbound request: {} {} => {}",
                req.method(),
                req.uri().path(),
                route.handler()
            );

            let res = match **route.handler() {
                "health" => mk_response("OK".to_owned()),
                "status" => mk_response(format!("monoliths: {}", ctx_read.monoliths.len())),
                "metrics" => mk_response("TODO: prometheus metrics".to_owned()),
                "room" => todo!("handle room api"),
                "monolith" => {
                    if crate::websocket::is_websocket_upgrade(&req) {
                        let (response, websocket) = crate::websocket::upgrade(req, None).unwrap();

                        // Spawn a task to handle the websocket connection.
                        let _ = tokio::task::Builder::new()
                            .name("monolith connection")
                            .spawn(async move {
                                if let Err(e) = monolith_entry(websocket, link).await {
                                    error!("Error in websocket connection: {}", e);
                                }
                            });

                        // Return the response so the spawned future can continue.
                        Ok(response)
                    } else {
                        mk_response("must upgrade to websocket".to_owned())
                    }
                }
                _ => Ok(not_found()),
            };
            res
        })
    }
}

/// HTTP status code 404
fn not_found() -> Response<Full<Bytes>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Full::new(NOTFOUND.into()))
        .unwrap()
}
