use futures_util::{pin_mut, SinkExt, StreamExt, TryStreamExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use url::Url;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    test_as_client().await
}

async fn test_as_client() -> anyhow::Result<()> {
    let (mut socket, response) = connect_async(Url::parse("ws://localhost:8081/api/room/test")?)
        .await
        .expect("Can't connect");

    println!("Connected to the server");
    println!("Response HTTP code: {}", response.status());

    let (mut write, read) = socket.split();

    let auth_msg = Message::Text("{\"action\":\"auth\", \"token\":\"foo\"}".into());
    write.send(auth_msg).await?;

    let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(read_stdin(stdin_tx));

    tokio::spawn(async move {
        read.for_each(|message| async {
            let data = message.unwrap().into_data();
            tokio::io::stdout().write_all(&data).await.unwrap();
        })
    });

    loop {
        tokio::select! {
            msg = stdin_rx.recv() => {
                if let Some(msg) = msg {
                    write.send(msg).await?;
                }
            },
        };
    }
}

// Our helper method which will read data from stdin and send it along the
// sender provided.
async fn read_stdin(tx: tokio::sync::mpsc::UnboundedSender<Message>) {
    let mut stdin = tokio::io::stdin();
    loop {
        let mut buf = vec![0; 1024];
        let n = match stdin.read(&mut buf).await {
            Err(_) | Ok(0) => break,
            Ok(n) => n,
        };
        buf.truncate(n);
        if let Ok(s) = String::from_utf8(buf) {
            tx.send(Message::Text(s.trim().into())).unwrap();
        }
    }
}
