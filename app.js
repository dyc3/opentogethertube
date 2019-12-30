const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { uniqueNamesGenerator } = require('unique-names-generator');

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

const session = require('express-session');
let sessionOpts = {
	secret: "opentogethertube", // FIXME: This doesn't matter right now, but when user accounts are implemented this should be fixed.
	resave: false,
	saveUninitialized: true,
	unset: 'keep',
	cookie: {
		expires: false,
		maxAge: 99999999999,
	},
};
if (process.env.NODE_ENV === "production") {
	app.set('trust proxy', 1);
	sessionOpts.cookie.secure = true;
}
const sessions = session(sessionOpts);
app.use(sessions);

app.use((req, res, next) => {
	if (!req.session.username) {
		let username = uniqueNamesGenerator();
		console.log("Generated name for new user: ", username);
		req.session.username = username;
		req.session.save();
	}

	next();
});

const storage = require("./storage");
const roommanager = require("./roommanager");
const api = require("./api")(roommanager, storage);
roommanager.start(server, sessions);

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
		if (contents) {
			res.send(contents.toString());
		}
		else {
			res.status(500).send("Failed to serve page, try again later.");
		}
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
