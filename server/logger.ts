import { createLogger, format, transports } from "winston";
import colors from "ansi-colors";
import { conf } from "./ott-config";
import { Counter } from "prom-client";

const myFormat = format.printf(({ level, message, timestamp, namespace, roomName, roomEvent }) => {
	counterLogs.inc({ level });
	if (roomEvent) {
		// HACK: video descriptions are long, so remove then to make logs easier to read.
		if (roomEvent.parameters && roomEvent.parameters.video) {
			delete roomEvent.parameters.video.description;
		}
		return `${timestamp} ${namespace} Room/${
			roomEvent.roomName
		} ${level} Room event: ${JSON.stringify(roomEvent)}`;
	}
	if (roomName) {
		return `${timestamp} ${namespace} Room/${roomName} ${level} ${message}`;
	}
	return `${timestamp} ${namespace} ${level} ${message}`;
});

const customColorizer = format(info => {
	info.timestamp = colors.green(info.timestamp);
	info.namespace = colors.blue(info.namespace);
	switch (info.level) {
		case "error":
			info.level = colors.bold.red(info.level);
			info.message = colors.red(info.message);
			break;
		case "warn":
			info.level = colors.bold.yellow(info.level);
			info.message = colors.yellow(info.message);
			break;
		case "info":
			info.level = colors.bold.white(info.level);
			info.message = colors.white(info.message);
			break;
		case "debug":
			info.level = colors.bold.green(info.level);
			info.message = colors.green(info.message);
			break;
		default:
			info.level = colors.bold(info.level);
			break;
	}
	return info;
});

const logger = createLogger({
	level: "info",
	format: format.combine(
		format.timestamp({
			format: "YYYY-MM-DD HH:mm:ss",
		}),
		myFormat
	),
});

if (conf.get("log.file")) {
	logger.add(new transports.File({ filename: conf.get("log.file")! }));
}

if (conf.get("env") !== "production") {
	logger.add(
		new transports.Console({
			format: format.combine(customColorizer(), myFormat),
			silent: conf.get("env") === "test",
		})
	);
} else {
	logger.add(
		new transports.Console({
			format: format.combine(customColorizer(), myFormat),
		})
	);
}

export function getLogger(namespace) {
	return logger.child({ namespace });
}
export function setLogLevel(level) {
	logger.level = level;
}

const counterLogs = new Counter({
	name: "ott_logs",
	help: "The number of messages logged",
	labelNames: ["level"],
});
