use std::pin::Pin;
use std::sync::Arc;

use bytes::Bytes;
use futures_util::Future;
use http_body_util::{BodyExt, Full};
use hyper::service::Service;
use hyper::StatusCode;
use hyper::{body::Incoming as IncomingBody, Request, Response};
use once_cell::sync::Lazy;
use ott_balancer_protocol::monolith::{RoomMetadata, Visibility};
use ott_balancer_protocol::RoomName;
use ott_common::websocket::{is_websocket_upgrade, upgrade};
use prometheus::{register_int_gauge, Encoder, IntGauge, TextEncoder};
use reqwest::Url;
use route_recognizer::Router;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tracing::{debug, error, field, info, span, warn, Level};

use crate::balancer::{BalancerContext, BalancerLink};
use crate::client::client_entry;
use crate::config::BalancerConfig;
use crate::monolith::BalancerMonolith;

static NOTFOUND: &[u8] = b"Not Found";

static ROUTER: Lazy<Router<&'static str>> = Lazy::new(|| {
    let mut router = Router::new();
    router.add("/api/status", "health");
    router.add("/api/balancing", "status");
    router.add("/api/state", "state");
    router.add("/api/state/stream", "state_stream");
    router.add("/api/status/metrics", "metrics");
    router.add("/api/room/:room_name", "room");
    router.add("/api/room/:room_name/", "room");
    router.add("/api/room/:room_name/*", "room");
    router.add("/", "other");
    router.add("*", "other");
    router
});

/// A service that handles HTTP requests.
///
/// An instance of this service is spawned for each incoming connection.
#[derive(Clone)]
pub struct BalancerService {
    pub(crate) ctx: Arc<RwLock<BalancerContext>>,
    pub(crate) link: BalancerLink,
    pub(crate) task_handle_tx: tokio::sync::mpsc::Sender<JoinHandle<()>>,
}

impl Service<Request<IncomingBody>> for BalancerService {
    type Response = Response<Full<Bytes>>;
    type Error = hyper::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn call(&self, req: Request<hyper::body::Incoming>) -> Self::Future {
        COUNTER_HTTP_REQUESTS.inc();
        let request_id = COUNTER_HTTP_REQUESTS.get();
        let _request_span = span!(
            Level::INFO,
            "http_request",
            request_id = request_id,
            version = ?req.version(),
            method = %req.method(),
            path = %req.uri().path(),
            handler = field::Empty,
        )
        .entered();

        fn mk_response(s: String) -> anyhow::Result<Response<Full<Bytes>>, hyper::Error> {
            Ok(Response::builder().body(Full::new(Bytes::from(s))).unwrap())
        }

        let ctx: Arc<RwLock<BalancerContext>> = self.ctx.clone();
        let link = self.link.clone();
        let task_handle_tx = self.task_handle_tx.clone();

        let Ok(route) = ROUTER.recognize(req.uri().path()) else {
            warn!("no route found for {}", req.uri().path());
            return Box::pin(async move { Ok(not_found()) });
        };
        let handler = **route.handler();
        tracing::Span::current().record("handler", handler);
        match handler {
            "status" | "health" | "metrics" => debug!("inbound request"),
            _ => info!("inbound request"),
        }

        Box::pin(async move {
            let res = match handler {
                "health" => mk_response("OK".to_owned()),
                "status" => {
                    if !is_authorized(&req) {
                        return Ok(Response::builder()
                            .status(StatusCode::UNAUTHORIZED)
                            .body(Full::new("unauthorized".into()))
                            .unwrap());
                    }
                    let ctx_read = ctx.read().await;
                    let rendered = [
                        format!("monoliths: {}", ctx_read.monoliths.len()),
                        format!("clients: {}", ctx_read.clients.len()),
                        format!("room mappings: {:#?}", ctx_read.rooms_to_monoliths),
                        format!("region mappings: {:#?}", ctx_read.monoliths_by_region),
                    ]
                    .join("\n");
                    mk_response(rendered)
                }
                "state" => {
                    if !is_authorized(&req) {
                        return Ok(Response::builder()
                            .status(StatusCode::UNAUTHORIZED)
                            .body(Full::new("unauthorized".into()))
                            .unwrap());
                    }
                    let ctx_read = ctx.read().await;
                    let state = ctx_read.current_state();
                    let Ok(body) = serde_json::to_vec(&state) else {
                        error!("error serializing state");
                        return Ok(interval_server_error());
                    };
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .body(Full::new(body.into()))
                        .unwrap())
                }
                "state_stream" => {
                    if !is_authorized(&req) {
                        return Ok(Response::builder()
                            .status(StatusCode::UNAUTHORIZED)
                            .body(Full::new("unauthorized".into()))
                            .unwrap());
                    }
                    if is_websocket_upgrade(&req) {
                        let (response, websocket) = match upgrade(req, None) {
                            Ok((response, websocket)) => (response, websocket),
                            Err(err) => {
                                error!(message = "failed to upgrade websocket: {:?}", request_id, error = %err);
                                return Ok(interval_server_error());
                            }
                        };

                        let handle = tokio::spawn(async move {
                            if let Err(err) =
                                crate::state_stream::handle_stream_websocket(websocket).await
                            {
                                error!("error handling event stream websocket: {}", err);
                            }
                        });
                        let _ = task_handle_tx.send(handle).await;

                        Ok(response)
                    } else {
                        Ok(Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .body(Full::new("expected websocket connection".into()))
                            .unwrap())
                    }
                }
                "metrics" => {
                    let bytes = match gather_metrics() {
                        Ok(bytes) => bytes,
                        Err(e) => {
                            error!("error gathering metrics: {}", e);
                            return Ok(Response::builder()
                                .status(StatusCode::INTERNAL_SERVER_ERROR)
                                .body(Full::new(Bytes::from(format!(
                                    "error gathering metrics: {}",
                                    e
                                ))))
                                .unwrap());
                        }
                    };

                    Ok(Response::builder().body(Full::new(bytes)).unwrap())
                }
                "room" => {
                    let Some(room_name) = route.params().find("room_name") else {
                        return Ok(not_found());
                    };

                    let room_name: RoomName = room_name.to_owned().into();
                    if room_name.to_string() == "list" {
                        // special case for listing rooms -- "list" is never a valid room name
                        return match list_rooms(ctx.clone()).await {
                            Ok(res) => Ok(res),
                            Err(e) => {
                                error!("error listing rooms: {}", e);
                                mk_response("error listing rooms".to_owned())
                            }
                        };
                    }

                    let ctx_read = ctx.read().await;
                    if ctx_read.monoliths.is_empty() {
                        debug!(message = "no monoliths", request_id, room = %room_name);
                        return Ok(no_monoliths());
                    }

                    if is_websocket_upgrade(&req) {
                        debug!(message = "upgrading to websocket", request_id, room = %room_name);
                        let (response, websocket) = match upgrade(req, None) {
                            Ok((response, websocket)) => (response, websocket),
                            Err(err) => {
                                error!(message = "failed to upgrade websocket: {:?}", request_id, room = %room_name, error = %err);
                                return Ok(interval_server_error());
                            }
                        };

                        // Spawn a task to handle the websocket connection.
                        let handle = tokio::task::Builder::new().name("client connection").spawn(
                            async move {
                                GAUGE_CLIENTS.inc();
                                if let Err(e) = client_entry(room_name, websocket, link).await {
                                    error!("Error in websocket connection: {}", e);
                                }
                                GAUGE_CLIENTS.dec();
                            },
                        );
                        match handle {
                            Ok(handle) => {
                                let _ = task_handle_tx.send(handle).await;
                            }
                            Err(err) => {
                                error!("Error spawning task to handle websocket: {}", err);
                                return Ok(interval_server_error());
                            }
                        }

                        // Return the response so the spawned future can continue.
                        Ok(response)
                    } else {
                        let monolith =
                            if let Some(locator) = ctx_read.rooms_to_monoliths.get(&room_name) {
                                info!(
                                    "found room {} in monolith {}",
                                    room_name,
                                    locator.monolith_id()
                                );
                                ctx_read.monoliths.get(&locator.monolith_id())
                            } else {
                                ctx_read.select_monolith().ok()
                            };
                        if let Some(monolith) = monolith {
                            info!("proxying request to monolith {}", monolith.id());
                            match proxy_request(req, monolith).await {
                                Ok(res) => Ok(res),
                                Err(err) => {
                                    error!("error proxying request: {}", err);
                                    mk_response("error proxying request".to_owned())
                                }
                            }
                        } else {
                            Ok(no_monoliths())
                        }
                    }
                }
                "other" => {
                    let ctx_read = ctx.read().await;
                    let monolith = ctx_read.random_monolith().ok();
                    if let Some(monolith) = monolith {
                        info!(
                            message = "proxying request to monolith",
                            monolith = %monolith.id(),
                        );
                        match proxy_request(req, monolith).await {
                            Ok(res) => Ok(res),
                            Err(err) => {
                                error!("error proxying request: {}", err);
                                mk_response("error proxying request".to_owned())
                            }
                        }
                    } else {
                        Ok(no_monoliths())
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

fn interval_server_error() -> Response<Full<Bytes>> {
    Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .body(Full::new("internal server error".into()))
        .unwrap()
}

fn no_monoliths() -> Response<Full<Bytes>> {
    Response::builder()
        .status(StatusCode::SERVICE_UNAVAILABLE)
        .body(Full::new(
            "No monoliths available to handle request.".into(),
        ))
        .expect("failed to build NO_MONOLITHS")
}

async fn proxy_request(
    in_req: Request<IncomingBody>,
    target: &BalancerMonolith,
) -> anyhow::Result<Response<Full<Bytes>>> {
    let client = target.http_client();
    let (parts, body) = in_req.into_parts();
    let mut url: Url = target.config().uri().clone();
    url.set_scheme("http").expect("failed to set scheme");
    url.set_port(Some(target.proxy_port()))
        .expect("failed to set port");
    url.set_path(parts.uri.path());
    url.set_query(parts.uri.query());
    // TODO: update X-Forwarded-For header
    // TODO: stream the body instead of loading it all into memory?

    let body: Bytes = body.collect().await?.to_bytes();
    let out_body: reqwest::Body = reqwest::Body::from(body);
    let req = client
        .request(parts.method, url)
        .headers(parts.headers)
        .body(out_body)
        .build()?;
    let res = client.execute(req).await?;
    let status = res.status();
    let mut builder = Response::builder().status(status);
    for (k, v) in res.headers().iter() {
        builder = builder.header(k, v);
    }
    let body = res.bytes().await?;
    Ok(builder.body(Full::new(body)).unwrap())
}

#[derive(serde::Serialize)]
struct ListedRoom<'a> {
    name: &'a RoomName,
    #[serde(flatten)]
    metadata: &'a RoomMetadata,
}

async fn list_rooms(ctx: Arc<RwLock<BalancerContext>>) -> anyhow::Result<Response<Full<Bytes>>> {
    info!("listing rooms");

    let mut rooms = Vec::new();
    let ctx_read = ctx.read().await;
    for monolith in ctx_read.monoliths.values() {
        let monolith_rooms = monolith.rooms().values();
        for r in monolith_rooms {
            if let Some(meta) = r.metadata() {
                if meta.visibility != Visibility::Public {
                    continue;
                }
                let room = ListedRoom {
                    name: r.name(),
                    metadata: meta,
                };
                rooms.push(room);
            }
        }

        if rooms.len() > 50 {
            break;
        }
    }

    let builder = Response::builder()
        .status(200)
        .header("Content-Type", "application/json");

    let body = serde_json::to_vec(&rooms)?;
    Ok(builder.body(Full::new(body.into())).unwrap())
}

fn gather_metrics() -> anyhow::Result<Bytes> {
    let mut buffer = vec![];
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    encoder.encode(&metric_families, &mut buffer)?;
    Ok(Bytes::from(buffer))
}

fn is_authorized<B>(req: &Request<B>) -> bool {
    if let Some(api_key) = BalancerConfig::get().api_key.as_ref() {
        let headers = req.headers();
        let auth = headers.get("Authorization");
        if let Some(auth) = auth {
            if auth.as_bytes().starts_with(b"Bearer ")
                && &auth.as_bytes()[7..] == api_key.as_bytes()
            {
                return true;
            }
        }
    }
    false
}

static GAUGE_CLIENTS: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!("balancer_clients", "Number of connected websocket clients").unwrap()
});

static COUNTER_HTTP_REQUESTS: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!("balancer_http_requests", "Number of HTTP requests received").unwrap()
});

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn route_rules_status() {
        assert_eq!(
            ROUTER.recognize("/api/status").unwrap().handler(),
            &&"health"
        );
        assert_eq!(
            ROUTER.recognize("/api/balancing").unwrap().handler(),
            &&"status"
        );
        assert_eq!(
            ROUTER.recognize("/api/status/metrics").unwrap().handler(),
            &&"metrics"
        );
    }

    #[test]
    fn route_rules_room() {
        let cases = [
            "/api/room/abc",
            "/api/room/abc/",
            "/api/room/abc/def",
            "/api/room/abc/def/",
            "/api/room/ded6b388-ff31-4e58-8cbc-24995d9a7356/queue",
        ];
        for case in cases.iter() {
            println!("case: {}", case);
            assert_eq!(ROUTER.recognize(case).unwrap().handler(), &&"room");
        }
    }

    #[test]
    fn route_rules_other() {
        let cases = [
            "/",
            "/foo",
            "/foo/bar",
            "/foo/bar/",
            "/foo/bar/baz",
            "/foo/bar/baz/",
            "/assets/foo.svg",
            "/api/data/previewAdd",
            "/api/auth/grant",
        ];
        for case in cases.iter() {
            println!("case: {}", case);
            assert_eq!(ROUTER.recognize(case).unwrap().handler(), &&"other");
        }
    }

    #[test]
    fn test_is_authorized_with_valid_api_key() {
        BalancerConfig::init_default();
        unsafe {
            BalancerConfig::get_mut().api_key = Some("YOUR_API_KEY".to_owned());
        }
        let req = Request::builder()
            .header("Authorization", "Bearer YOUR_API_KEY")
            .body(Full::new(Bytes::new()))
            .unwrap();

        assert!(is_authorized(&req));
    }

    #[test]
    fn test_is_authorized_with_invalid_api_key() {
        BalancerConfig::init_default();
        unsafe {
            BalancerConfig::get_mut().api_key = Some("YOUR_API_KEY".to_owned());
        }
        let req = Request::builder()
            .header("Authorization", "Bearer INVALID_API_KEY")
            .body(Full::new(Bytes::new()))
            .unwrap();

        assert!(!is_authorized(&req));
    }

    #[test]
    fn test_is_authorized_without_authorization_header() {
        BalancerConfig::init_default();
        unsafe {
            BalancerConfig::get_mut().api_key = Some("YOUR_API_KEY".to_owned());
        }
        let req = Request::builder().body(Full::new(Bytes::new())).unwrap();

        assert!(!is_authorized(&req));
    }

    #[test]
    fn test_is_authorized_with_different_authorization_scheme() {
        BalancerConfig::init_default();
        unsafe {
            BalancerConfig::get_mut().api_key = Some("YOUR_API_KEY".to_owned());
        }
        let req = Request::builder()
            .header("Authorization", "Basic YOUR_API_KEY")
            .body(Full::new(Bytes::new()))
            .unwrap();

        assert!(!is_authorized(&req));
    }

    #[test]
    fn test_is_authorized_without_api_key_set() {
        BalancerConfig::init_default();
        unsafe {
            BalancerConfig::get_mut().api_key = None;
        }
        let req = Request::builder()
            .header("Authorization", "Basic YOUR_API_KEY")
            .body(Full::new(Bytes::new()))
            .unwrap();

        assert!(!is_authorized(&req));
    }
}
