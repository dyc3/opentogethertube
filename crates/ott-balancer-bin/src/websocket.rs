//! Heavily inspired by `hyper_tungstenite`.

use http_body_util::Full;
use hyper::body::Bytes;
use hyper::{Request, Response};
use pin_project::pin_project;
use std::pin::Pin;
use std::task::{Context, Poll};
use tracing::error;

use tokio_tungstenite::tungstenite::protocol::{Role, WebSocketConfig};
use tungstenite::handshake::derive_accept_key;
use tungstenite::{error::ProtocolError, Error};

pub use hyper;
pub use tungstenite;

pub use tokio_tungstenite::WebSocketStream;

/// A future that resolves to a websocket stream when the associated HTTP upgrade completes.
#[pin_project]
#[derive(Debug)]
pub struct HyperWebsocket {
    #[pin]
    inner: hyper::upgrade::OnUpgrade,
    config: Option<WebSocketConfig>,
}

impl std::future::Future for HyperWebsocket {
    type Output = Result<WebSocketStream<hyper::upgrade::Upgraded>, Error>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        let this = self.project();
        let maybe_upgraded = match this.inner.poll(cx) {
            Poll::Pending => return Poll::Pending,
            Poll::Ready(x) => x,
        };

        let upgraded = match maybe_upgraded {
            Ok(upgraded) => upgraded,
            Err(err) => {
                error!("Error upgrading websocket: {err}");
                return Poll::Ready(Err(Error::Protocol(ProtocolError::HandshakeIncomplete)));
            }
        };

        let stream = WebSocketStream::from_raw_socket(upgraded, Role::Server, this.config.take());
        tokio::pin!(stream);

        // The future returned by `from_raw_socket` is always ready.
        match stream.as_mut().poll(cx) {
            Poll::Pending => unreachable!("from_raw_socket should always be created ready"),
            Poll::Ready(x) => Poll::Ready(Ok(x)),
        }
    }
}

/// Try to upgrade a received `hyper::Request` to a websocket connection, consuming the request.
///
/// The function returns a HTTP response and a future that resolves to the websocket stream.
/// The response body *MUST* be sent to the client before the future can be resolved.
///
/// This functions checks `Sec-WebSocket-Key` and `Sec-WebSocket-Version` headers.
/// It does not inspect the `Origin`, `Sec-WebSocket-Protocol` or `Sec-WebSocket-Extensions` headers.
/// You can inspect the headers manually before calling this function,
/// and modify the response headers appropriately.
///
/// You should only call this function if [`is_websocket_upgrade`] returns true.
pub fn upgrade<B>(
    request: Request<B>,
    config: Option<WebSocketConfig>,
) -> Result<(Response<Full<Bytes>>, HyperWebsocket), ProtocolError> {
    let key = request
        .headers()
        .get("Sec-WebSocket-Key")
        .ok_or(ProtocolError::MissingSecWebSocketKey)?;
    if request
        .headers()
        .get("Sec-WebSocket-Version")
        .map(|v| v.as_bytes())
        != Some(b"13")
    {
        return Err(ProtocolError::MissingSecWebSocketVersionHeader);
    }

    let response = Response::builder()
        .status(hyper::StatusCode::SWITCHING_PROTOCOLS)
        .header(hyper::header::CONNECTION, "upgrade")
        .header(hyper::header::UPGRADE, "websocket")
        .header("Sec-WebSocket-Accept", &derive_accept_key(key.as_bytes()))
        .body(Full::from("switching to websocket protocol"))
        .expect("bug: failed to build response");

    let stream = HyperWebsocket {
        inner: hyper::upgrade::on(request),
        config,
    };

    Ok((response, stream))
}

/// Check if a request is a websocket upgrade request.
pub fn is_websocket_upgrade<B>(req: &hyper::Request<B>) -> bool {
    let headers = req.headers();
    let connection = headers.get(hyper::header::CONNECTION);
    let upgrade = headers.get(hyper::header::UPGRADE);
    match (connection, upgrade) {
        (Some(connection), Some(upgrade)) => match (connection.to_str(), upgrade.to_str()) {
            (Ok(connection), Ok(upgrade)) => {
                connection.trim() == "Upgrade" && upgrade.trim() == "websocket"
            }
            _ => false,
        },
        _ => return false,
    }
}
