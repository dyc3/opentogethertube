import http from "k6/http";
import ws from "k6/ws";
import { sleep, check } from "k6";
import { getAuthToken, HOSTNAME } from "./utils.js";

export const options = {
	// A number specifying the number of VUs to run concurrently.
	vus: 20,
	// A string specifying the total duration of the test run.
	duration: "60s",

	// The following section contains configuration options for execution of this
	// test script in Grafana Cloud.
	//
	// See https://grafana.com/docs/grafana-cloud/k6/get-started/run-cloud-tests-from-the-cli/
	// to learn about authoring and running k6 test scripts in Grafana k6 Cloud.
	//
	// ext: {
	//   loadimpact: {
	//     // The ID of the project to which the test is assigned in the k6 Cloud UI.
	//     // By default tests are executed in default project.
	//     projectID: "",
	//     // The name of the test in the k6 Cloud UI.
	//     // Test runs with the same name will be grouped.
	//     name: "script.js"
	//   }
	// },

	// Uncomment this section to enable the use of Browser API in your tests.
	//
	// See https://grafana.com/docs/k6/latest/using-k6-browser/running-browser-tests/ to learn more
	// about using Browser API in your test scripts.
	//
	// scenarios: {
	//   // The scenario name appears in the result summary, tags, and so on.
	//   // You can give the scenario any name, as long as each name in the script is unique.
	//   ui: {
	//     // Executor is a mandatory parameter for browser-based tests.
	//     // Shared iterations in this case tells k6 to reuse VUs to execute iterations.
	//     //
	//     // See https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ for other executor types.
	//     executor: 'shared-iterations',
	//     options: {
	//       browser: {
	//         // This is a mandatory parameter that instructs k6 to launch and
	//         // connect to a chromium-based browser, and use it to run UI-based
	//         // tests.
	//         type: 'chromium',
	//       },
	//     },
	//   },
	// }
};

// The function that defines VU logic.
//
// See https://grafana.com/docs/k6/latest/examples/get-started-with-k6/ to learn more
// about authoring k6 scripts.
//
export default function () {
	const token = getAuthToken();
	let resp = http.post(`http://${HOSTNAME}/api/room/generate`, null, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	check(resp, { "generated room": r => r && r.status === 201 });

	const room = JSON.parse(resp.body).room;
	check(room, { "room is not empty": r => r && r.length > 0 });

	const url = `ws://${HOSTNAME}/api/room/${room}`;
	const res = ws.connect(url, null, function (socket) {
		const msgs = [];
		socket.on("open", () => {
			console.log("connected");
			socket.send(JSON.stringify({ action: "auth", token: token }));
		});
		socket.on("message", data => {
			console.log("Message received: ", data);
			const msg = JSON.parse(data);
			msgs.push(msg);

			if (msg.action === "sync") {
				socket.close();
			}
		});
		socket.on("close", () => {
			console.log("disconnected");
			check(msgs, {
				"got sync message": msgs => msgs.find(m => m.action === "sync") !== undefined,
			});
		});
		socket.setTimeout(function () {
			console.log("closing the socket");
			socket.close();
		}, 1000);
	});

	check(res, { "status is 101": r => r && r.status === 101 });
}
