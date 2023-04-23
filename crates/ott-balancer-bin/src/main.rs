#[macro_use]
extern crate rocket;
use rocket_ws as ws;

mod balancer;

#[get("/")]
fn index(ws: ws::WebSocket) -> ws::Stream!['static] {
    ws::Stream! { ws =>
        for await message in ws {
            yield message?;
        }
    }
}

#[launch]
fn launch() -> _ {
    rocket::build().mount("/", routes![index])
}
