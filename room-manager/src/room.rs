use actix::prelude::*;
use std::collections::HashMap;
use rand::{rngs::ThreadRng, Rng};

use crate::messages::*;


#[derive(Debug, Clone)]
pub struct Room {
	clients: HashMap<usize, Recipient<crate::messages::Message>>,
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