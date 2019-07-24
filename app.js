const Sequelize = require('sequelize');
const express = require('express');
const http = require('http');


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

app.use(function (req, res, next) {
	console.log(">", req.method, req.path, req.params);
	if (req.method == "POST") {
		console.log("   -", req.body);
	}
	next();
});

app.use("/api", api);

//start our server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server started on port ${server.address().port}`);
});