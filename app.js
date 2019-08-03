const Sequelize = require('sequelize');
const express = require('express');
const http = require('http');
const fs = require('fs');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite', /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */
	storage: 'db/dev.sqlite'
});

const app = express();
const server = http.createServer(app);

const roommanager = require("./roommanager")(server);
const api = require("./api")(roommanager);

const bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}));

// Redirect urls with trailing slashes
app.get('\\S+\/$', function (req, res) {
	return res.redirect(301, req.path.slice(0, -1) + req.url.slice(req.path.length));
});

app.use(function (req, res, next) {
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
	app.use(express.static(__dirname + "/dist", redirect=false));
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