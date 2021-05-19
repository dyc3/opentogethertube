//! Simple echo websocket server.
//! Open `http://localhost:8080/ws/index.html` in browser
//! or [python console client](https://github.com/actix/examples/blob/master/websocket/websocket-client.py)
//! could be used for testing.

use std::{collections::HashMap, time::{Duration, Instant}};

use actix::prelude::*;
use actix_files as fs;
use actix_web::{middleware, web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;
use rand::{rngs::ThreadRng, Rng};

// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);


/// do websocket handshake and start `MyWebSocket` actor
async fn ws_index(r: HttpRequest, stream: web::Payload, room: web::Data<Addr<Room>>) -> Result<HttpResponse, Error> {
	let res = ws::start(
		Client {
			id: 0,
			hb: Instant::now(),
			addr: room.get_ref().clone()
		},
		&r,
		stream,
	);
	res
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct Message(pub String);

/// New chat session is created
#[derive(Message)]
#[rtype(usize)]
pub struct Connect {
	pub addr: Recipient<Message>,
}

/// Session is disconnected
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
	pub id: usize,
}

/// Send message to specific room
#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientMessage {
	/// Id of the client session
	pub id: usize,
	/// Peer message
	pub msg: String,
}

#[derive(Debug, Clone)]
pub struct Room {
	clients: HashMap<usize, Recipient<Message>>,
	rng: ThreadRng,
}

impl Room {
	pub fn new() -> Room {
		Room {
			clients: HashMap::new(),
			rng: rand::thread_rng(),
		}
	}

	fn send_message(&self, message: &str) {
		for client in &self.clients {
			let _ = client.1.do_send(Message(message.to_owned()));
		}
	}
}

impl Actor for Room {
	type Context = Context<Self>;
}

impl Handler<Connect> for Room {
	type Result = usize;

	fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
		println!("client connected");
		let id = self.rng.gen::<usize>();
		self.clients.insert(id, msg.addr);
		id
	}
}

impl Handler<Disconnect> for Room {
	type Result = ();

	fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) -> Self::Result {
		println!("client disconnected");
		self.clients.remove(&msg.id);
	}
}

impl Handler<ClientMessage> for Room {
	type Result = ();

	fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
		self.send_message(msg.msg.as_str());
	}
}

struct Client {
	/// unique session id
	id: usize,
	/// Client must send ping at least once per 10 seconds (CLIENT_TIMEOUT),
	/// otherwise we drop connection.
	hb: Instant,
	/// Chat server
	addr: Addr<Room>,
}

impl Actor for Client {
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

impl Client {
	fn hb(&self, ctx: &mut <Self as Actor>::Context) {
		ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
			// check client heartbeats
			if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
				// heartbeat timed out
				println!("Websocket Client heartbeat failed, disconnecting!");

				// stop actor
				ctx.stop();

				// don't try to send a ping
				return;
			}

			ctx.ping(b"");
		});
	}
}

impl Handler<Message> for Client {
	type Result = ();

	fn handle(&mut self, msg: Message, ctx: &mut Self::Context) {
		ctx.text(msg.0);
	}
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for Client {
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
	std::env::set_var("RUST_LOG", "actix_server=info,actix_web=info");
	env_logger::init();

	let server = Room::new().start();

	HttpServer::new(move || {
		App::new()
			.data(server.clone())
			// enable logger
			.wrap(middleware::Logger::default())
			// websocket route
			.service(web::resource("/echo").route(web::get().to(ws_index)))
			// static files
			.service(fs::Files::new("/", "static/").index_file("index.html"))
	})
	// start http server on 127.0.0.1:8080
	.bind("127.0.0.1:8080")?
	.run()
	.await
}
