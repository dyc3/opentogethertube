use websocket::client::builder::ClientBuilder;
use websocket::dataframe::DataFrame;
use websocket::ws::Sender;

fn main() -> anyhow::Result<()> {
    test_auth_message()?;

    Ok(())
}

fn test_malformed_JSON() -> anyhow::Result<()> {
    let mut client = ClientBuilder::new("ws://localhost:3000/api/room/test")?.connect_insecure()?;

    client.send_message(&websocket::OwnedMessage::Text("Hello, world!".to_string()))?;

    Ok(())
}

fn test_malformed_header_rsv2_rsv3() -> anyhow::Result<()> {
    let mut client = ClientBuilder::new("ws://localhost:3000/api/room/test")?.connect_insecure()?;

    let dataframe = DataFrame {
        finished: true,
        reserved: [false, true, true],
        opcode: websocket::dataframe::Opcode::Text,
        data: "{\"action\":\"auth\", \"token\":\"foo\"}"
            .to_string()
            .into_bytes(),
    };

    client.send_dataframe(&dataframe)?;

    Ok(())
}

fn test_auth_message() -> anyhow::Result<()> {
    let mut client = ClientBuilder::new("ws://localhost:8081/api/room/test")?.connect_insecure()?;

    let dataframe = DataFrame {
        finished: true,
        reserved: [false, false, false],
        opcode: websocket::dataframe::Opcode::Text,
        data: "{\"action\":\"auth\", \"token\":\"foo\"}"
            .to_string()
            .into_bytes(),
    };

    client.send_dataframe(&dataframe)?;

    let dataframe = DataFrame {
        finished: true,
        reserved: [false, false, false],
        opcode: websocket::dataframe::Opcode::Text,
        data: "{\"action\":\"kickme\", \"reason\": 4000}"
            .to_string()
            .into_bytes(),
    };

    client.send_dataframe(&dataframe)?;

    Ok(())
}
