use clap::Parser;
use futures_util::{SinkExt, StreamExt};
use tokio::io::AsyncReadExt;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{debug, error, info, Level};
use url::Url;

mod cli;
mod monolith;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::SubscriberBuilder::default()
        .with_max_level(Level::DEBUG)
        .init();

    let args = cli::Args::parse();

    match args.mode {
        cli::ClientMode::Monolith => test_as_monolith(args).await,
        cli::ClientMode::Client => test_as_client(args).await,
    }
}

async fn test_as_monolith(_args: cli::Args) -> anyhow::Result<()> {
    let (socket, response) = connect_async(Url::parse("ws://localhost:8081/monolith")?)
        .await
        .expect("Can't connect");

    info!("Connected to the server as a monolith");
    debug!("Response HTTP code: {}", response.status());

    let (mut write, mut read) = socket.split();

    let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(read_stdin(stdin_tx));

    let monolith = monolith::SimMonolith::new();
    let (_handle, inbound_tx, mut outbound_rx) = monolith.start();

    tokio::spawn(async move {
        let inbound_tx = inbound_tx.clone();
        while let Some(msg) = read.next().await {
            match msg {
                Ok(msg) => {
                    let data = msg.to_text().unwrap().to_string();
                    debug!("Received: {}", data);
                    inbound_tx.send(msg).await.unwrap();
                }
                Err(err) => {
                    error!("Error reading message from server: {:?}", err);
                }
            }
        }
    });

    loop {
        tokio::select! {
            msg = stdin_rx.recv() => {
                if let Some(msg) = msg {
                    write.send(msg).await?;
                }
            },
            msg = outbound_rx.recv() => {
                if let Some(msg) = msg {
                    write.send(msg).await?;
                }
            },
        };
    }
}

async fn test_as_client(args: cli::Args) -> anyhow::Result<()> {
    let (socket, response) = connect_async(Url::parse(
        format!("ws://localhost:8081/api/room/{}", args.room).as_str(),
    )?)
    .await
    .expect("Can't connect");

    info!(
        "Connected to the server as a client, joining room {}",
        args.room
    );
    debug!("Response HTTP code: {}", response.status());

    let (mut write, mut read) = socket.split();

    let auth_msg = Message::Text("{\"action\":\"auth\", \"token\":\"foo\"}".into());
    write.send(auth_msg).await?;
    debug!("Sent auth message");

    let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(read_stdin(stdin_tx));

    loop {
        tokio::select! {
            msg = stdin_rx.recv() => {
                if let Some(msg) = msg {
                    if args.echo {
                        let echo = monolith::SimpleEcho {
                            echo: msg.to_string(),
                        };
                        let echo = serde_json::to_string(&echo).unwrap();
                        write.send(Message::Text(echo)).await?;
                    } else {
                        write.send(msg).await?;
                    }
                }
            },
            msg = read.next() => {
                if let Some(Ok(msg)) = msg {
                    let data = msg.to_text().unwrap().to_string();
                    info!("Received: {}", data);
                }
            }
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
