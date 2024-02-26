#[macro_use]
extern crate rocket;

mod cors;

/// Serve the current system state
#[get("/state")]
fn serve_state() {
    todo!("Serve the current system state")
}

#[launch]
fn rocket() -> _ {
    // TODO: spawn discovery tokio task here

    rocket::build()
        .attach(cors::Cors)
        .mount("/", routes![status, cors::handle_preflight, serve_state])
}

#[get("/status")]
fn status() -> &'static str {
    "OK"
}
