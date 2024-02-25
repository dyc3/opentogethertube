#[macro_use]
extern crate rocket;

use serde_json::json;
use serde_json::Value;

const sampleSystemState: [Value; 3] = [
	json!({
		"id": "154d9d41-128c-45ab-83d8-28661882c9e3",
		"region": "ewr",
		"monoliths": [
			json!({
				"id": "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				"region": "ewr",
				"rooms": [
					{ "name": "foo", "clients": 2 },
					{ "name": "bar", "clients": 0 },
				],
			}),
			json!({
				"id": "419580cb-f576-4314-8162-45340c94bae1",
				"region": "ewr",
				"rooms": [{ "name": "baz", "clients": 3 }],
			}),
			json!({
				"id": "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				"region": "cdg",
				"rooms": [{ "name": "qux", "clients": 0 }],
			}),
		],
	}),
	json!({
		"id": "c91d183c-980e-4160-b196-43658148f469",
		"region": "ewr",
		"monoliths": [
			json!({
				"id": "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				"region": "ewr",
				"rooms": [
					{ "name": "foo", "clients": 1 },
					{ "name": "bar", "clients": 2 },
				],
			}),
			json!({
				"id": "419580cb-f576-4314-8162-45340c94bae1",
				"region": "ewr",
				"rooms": [{ "name": "baz", "clients": 0 }],
			}),
			json!({
				"id": "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				"region": "cdg",
				"rooms": [{ "name": "qux", "clients": 0 }],
			}),
		],
	}),
	json!({
		"id": "5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0",
		"region": "cdg",
		"monoliths": [
			json!({
				"id": "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				"region": "ewr",
				"rooms": [
					{ "name": "foo", "clients": 0 },
					{ "name": "bar", "clients": 0 },
				],
			}),
			json!({
				"id": "419580cb-f576-4314-8162-45340c94bae1",
				"region": "ewr",
				"rooms": [{ "name": "baz", "clients": 0 }],
			}),
			json!({
				"id": "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				"region": "cdg",
				"rooms": [{ "name": "qux", "clients": 4 }],
			}),
		],
	}),
];

/// Serve the current system state
#[get("/state")]
fn serve_state() -> [Value; 3] {
    return sampleSystemState;
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
