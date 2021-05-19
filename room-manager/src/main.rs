use actix::prelude::*;
use actix_files as fs;
use actix_web::{middleware, web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;

mod room;
mod messages;
mod connection_manager;

use crate::room::*;
use uuid::Uuid;
use serde::*;
use crate::connection_manager::*;

#[derive(Debug, Clone, Serialize)]
struct RoomCreateResponse {
	room: String,
	success: bool,
}

fn generate_room(req: HttpRequest) -> HttpResponse {
	HttpResponse::Ok()
		.json(RoomCreateResponse {
			room: Uuid::new_v4().to_string(),
			success: true,
		})
}

/// do websocket handshake and start `MyWebSocket` actor
async fn ws_index(r: HttpRequest, stream: web::Payload, room: web::Data<Addr<room::Room>>) -> Result<HttpResponse, Error> {
	let res = ws::start(
		OttClient::new(room.get_ref().clone()),
		&r,
		stream,
	);
	res
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
	std::env::set_var("RUST_LOG", "actix_server=info,actix_web=info");
	env_logger::init();

	let server = Room::new().start();

	HttpServer::new(move || {
		App::new()
			.data(server.clone())
			.wrap(middleware::Logger::default())
			.service(web::resource("/api/room/generate").route(web::post().to(generate_room)))
			.service(web::resource("/api/room/{name}").route(web::get().to(ws_index)))
			.service(fs::Files::new("/", "../dist/").index_file("index.html"))
	})
	// start http server on 127.0.0.1:8080
	.bind("127.0.0.1:3001")?
	.run()
	.await
}
