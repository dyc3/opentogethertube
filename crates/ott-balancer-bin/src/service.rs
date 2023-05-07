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
use tracing::debug;

use crate::balancer::{BalancerContext, BalancerLink};

static NOTFOUND: &[u8] = b"Not Found";

static ROUTER: Lazy<Router<&'static str>> = Lazy::new(|| {
    let mut router = Router::new();
    router.add("/api/status", "status");
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

        Box::pin(async move {
            let ctx_read = ctx.read().await;
            let Ok(route) = ROUTER.recognize(req.uri().path()) else {
                return Ok(not_found());
            };
            debug!("Inbound request: {} {}", req.method(), route.handler());

            let res = match **route.handler() {
                "status" => mk_response("OK".to_owned()),
                "metrics" => mk_response("TODO: prometheus metrics".to_owned()),
                "room" => todo!("handle room api"),
                "monolith" => todo!("handle monolith connection"),
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
