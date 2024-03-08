use rocket::{
    futures::{SinkExt, StreamExt},
    State,
};

/// Handles all the raw events being streamed from balancers and parses and filters them into only the events we care about.
pub struct EventBus {
    events_rx: tokio::sync::mpsc::Receiver<String>,

    bus_tx: tokio::sync::broadcast::Sender<EventBusEvent>,
}

impl EventBus {
    pub fn new(events_rx: tokio::sync::mpsc::Receiver<String>) -> Self {
        let (bus_tx, _) = tokio::sync::broadcast::channel(100);
        Self { events_rx, bus_tx }
    }

    #[must_use]
    pub fn spawn(mut self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run().await;
            warn!("EventBus task ended");
        })
    }

    pub async fn run(&mut self) {
        loop {
            tokio::select! {
                Some(event) = self.events_rx.recv() => {
                    self.handle_event(event);
                }
                else => {
                    break;
                }
            }
        }
    }

    fn handle_event(&self, event: String) {
        info!("Received event: {}", event);
        if let Ok(_) = self.bus_tx.send(event) {
            info!("Event sent to subscribers");
        }
    }

    pub fn subscriber(&self) -> EventBusSubscriber {
        EventBusSubscriber::new(self.bus_tx.clone())
    }
}

type EventBusEvent = String;

/// Enables subscriptions to the event bus
pub struct EventBusSubscriber {
    bus_tx: tokio::sync::broadcast::Sender<EventBusEvent>,
}

impl EventBusSubscriber {
    pub fn new(bus_tx: tokio::sync::broadcast::Sender<EventBusEvent>) -> Self {
        Self { bus_tx }
    }

    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<EventBusEvent> {
        self.bus_tx.subscribe()
    }
}

#[get("/state/stream")]
pub fn event_stream(
    ws: rocket_ws::WebSocket,
    event_bus: &State<EventBusSubscriber>,
) -> rocket_ws::Channel<'static> {
    let mut rx = event_bus.subscribe();
    ws.channel(move |mut stream| {
        Box::pin(async move {
            loop {
                tokio::select! {
                    Ok(event) = rx.recv() => {
                        if let Err(_) = stream.send(rocket_ws::Message::text(event)).await {
                            break;
                        }
                    }
                    Some(msg) = stream.next() => {
                        match msg {
                            Ok(rocket_ws::Message::Close(_)) => {
                                break;
                            }
                            _ => {}
                        }
                    }
                    else => {
                        break;
                    }
                }
            }
            Ok(())
        })
    })
}
