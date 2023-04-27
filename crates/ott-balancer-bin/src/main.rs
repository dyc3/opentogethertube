#[macro_use]
extern crate rocket;
use std::sync::Arc;

use balancer::{start_dispatcher, Balancer, BalancerContext};
use rocket::fairing::AdHoc;
use rocket_ws as ws;
use tokio::sync::RwLock;

mod balancer;
mod client;
mod messages;
mod monolith;
mod protocol;

#[launch]
fn launch() -> _ {
    console_subscriber::init();

    let ctx = Arc::new(RwLock::new(BalancerContext::new()));
    let balancer = Balancer::new(ctx.clone());
    let link = balancer.new_link();

    rocket::build()
        .manage(link)
        .attach(AdHoc::on_liftoff("start dispatcher", |_| {
            Box::pin(async move {
                start_dispatcher(balancer);
            })
        }))
        .mount(
            "/",
            routes![crate::monolith::monolith_entry, crate::client::client_entry],
        )
}
