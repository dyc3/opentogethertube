use actix::prelude::*;

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