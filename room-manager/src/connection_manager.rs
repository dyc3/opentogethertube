use actix::prelude::*;
use actix_web_actors::ws;
use std::{collections::HashMap, time::{Duration, Instant}};

use crate::room::*;
use crate::messages::*;

// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

pub struct OttClient {
	/// unique session id
	id: usize,
	/// Client must send ping at least once per 10 seconds (CLIENT_TIMEOUT),
	/// otherwise we drop connection.
	hb: Instant,
	/// Chat server
	addr: Addr<Room>,
}

impl OttClient {
	pub fn new(addr: Addr<Room>) -> OttClient {
		OttClient {
			id: 0,
			hb: Instant::now(),
			addr: addr,
		}
	}

	fn hb(&self, ctx: &mut <Self as Actor>::Context) {
		ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
			if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
				println!("Websocket Client heartbeat failed, disconnecting!");
				ctx.stop();
				return;
			}

			ctx.ping(b"");
		});
	}
}

impl Actor for OttClient {
	type Context = ws::WebsocketContext<Self>;

	/// Method is called on actor start.
	/// We register ws session with ChatServer
	fn started(&mut self, ctx: &mut Self::Context) {
		// we'll start heartbeat process on session start.
		self.hb(ctx);

		// register self in chat server. `AsyncContext::wait` register
		// future within context, but context waits until this future resolves
		// before processing any other events.
		// HttpContext::state() is instance of WsChatSessionState, state is shared
		// across all routes within application
		let addr = ctx.address();
		self.addr
			.send(Connect {
				addr: addr.recipient(),
			})
			.into_actor(self)
			.then(|res, act, ctx| {
				match res {
					Ok(res) => act.id = res,
					// something is wrong with chat server
					_ => ctx.stop(),
				}
				fut::ready(())
			})
			.wait(ctx);
	}

	fn stopping(&mut self, _: &mut Self::Context) -> Running {
		// notify chat server
		self.addr.do_send(Disconnect { id: self.id });
		Running::Stop
	}
}

impl Handler<crate::messages::Message> for OttClient {
	type Result = ();

	fn handle(&mut self, msg: crate::messages::Message, ctx: &mut Self::Context) {
		ctx.text(msg.0);
	}
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for OttClient {
	fn handle(
		&mut self,
		msg: Result<ws::Message, ws::ProtocolError>,
		ctx: &mut Self::Context,
	) {
		let msg = match msg {
			Err(_) => {
				ctx.stop();
				return;
			}
			Ok(msg) => msg,
		};

		// println!("WEBSOCKET MESSAGE: {:?}", msg);
		match msg {
			ws::Message::Ping(msg) => {
				self.hb = Instant::now();
				ctx.pong(&msg);
			}
			ws::Message::Pong(_) => {
				self.hb = Instant::now();
			}
			ws::Message::Text(text) => {
				let m = text.trim();
				self.addr.do_send(ClientMessage {
					id: self.id,
					msg: m.to_owned(),
				})
			}
			ws::Message::Binary(_) => println!("Unexpected binary"),
			ws::Message::Close(reason) => {
				ctx.close(reason);
				ctx.stop();
			}
			ws::Message::Continuation(_) => {
				ctx.stop();
			}
			ws::Message::Nop => (),
		}
	}
}

