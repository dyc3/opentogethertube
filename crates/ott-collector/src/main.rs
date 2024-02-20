#[macro_use]
extern crate rocket;

/// Serve the current system state
#[get("/state")]
fn serve_state() {
    todo!("Serve the current system state")
}

#[launch]
fn rocket() -> _ {
    // TODO: spawn discovery tokio task here

    rocket::build()
        .mount("/", routes![status])
        .mount("/", routes![serve_state])
}

#[get("/status")]
fn status() -> &'static str {
    "OK"
}
