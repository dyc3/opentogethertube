use tungstenite::{connect, Message};
use url::Url;

fn main() -> anyhow::Result<()> {
    test_as_client()
}

fn test_as_client() -> anyhow::Result<()> {
    let (mut socket, response) =
        connect(Url::parse("ws://localhost:8081/api/room/test")?).expect("Can't connect");

    println!("Connected to the server");
    println!("Response HTTP code: {}", response.status());

    socket.write_message(Message::Text(
        "{\"action\":\"auth\", \"token\":\"foo\"}".into(),
    ))?;
    loop {
        let msg = socket.read_message().expect("Error reading message");
        println!("Received: {}", msg);
    }
    socket.close(None);
}
