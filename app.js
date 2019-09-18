const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

if (!process.env.NODE_ENV) {
	console.warn("NODE_ENV not set, assuming dev environment");
	process.env.NODE_ENV = "development";
}

if (process.env.NODE_ENV === "example") {
	console.error("Invalid NODE_ENV! Aborting...");
	process.exit(1);
}

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
console.log(`Reading config from ${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
	console.error("No config found! Things will break!", config_path);
}
require('dotenv').config({ path: config_path });

const app = express();
const server = http.createServer(app);

const storage = require("./storage");
const roommanager = require("./roommanager")(server, storage);
const api = require("./api")(roommanager, storage);

const bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true,
}));

// Redirect urls with trailing slashes
app.get('\\S+/$', (req, res) => {
	return res.redirect(301, req.path.slice(0, -1) + req.url.slice(req.path.length));
});

app.use((req, res, next) => {
	console.log(">", req.method, req.path, req.params);
	if (req.method == "POST") {
		console.log("   -", req.body);
	}
	next();
});

function serveBuiltFiles(req, res) {
	fs.readFile("dist/index.html", (err, contents) => {
		res.setHeader("Content-type", "text/html");
		res.send(contents.toString());
	});
}

app.use("/api", api);
if (fs.existsSync("./dist")) {
	app.use(express.static(__dirname + "/dist", false));
	app.get("/", serveBuiltFiles);
	app.get("/rooms", serveBuiltFiles);
	app.get("/room/:roomId", serveBuiltFiles);
}
else {
	console.warn("no dist folder found");
}

//start our server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server started on port ${server.address().port}`);
});
