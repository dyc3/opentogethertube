const { createLogger, format, transports } = require('winston');
const colors = require('ansi-colors');

const myFormat = format.printf(({ level, message, timestamp, namespace, roomName, roomEvent }) => {
	if (roomName) {
		if (roomEvent) {
			// HACK: video descriptions are long, so remove then to make logs easier to read.
			if (roomEvent.parameters && roomEvent.parameters.video) {
				delete roomEvent.parameters.video.description;
			}
			delete roomEvent.roomName;
			return `${timestamp} ${namespace} Room/${roomName} ${level} Room event: ${JSON.stringify(roomEvent)}`;
		}
		return `${timestamp} ${namespace} Room/${roomName} ${level} ${message}`;
	}
	return `${timestamp} ${namespace} ${level} ${message}`;
});

const customColorizer = format(info => {
	info.timestamp = colors.green(info.timestamp);
	info.namespace = colors.blue(info.namespace);
	if (info.level == "error") {
		info.level = colors.bold.red(info.level);
		info.message = colors.red(info.message);
	}
	else if (info.level == "warn") {
		info.level = colors.bold.yellow(info.level);
		info.message = colors.yellow(info.message);
	}
	else if (info.level == "info") {
		info.level = colors.bold.white(info.level);
		info.message = colors.white(info.message);
	}
	else if (info.level == "debug") {
		info.level = colors.bold.green(info.level);
		info.message = colors.green(info.message);
	}
	else {
		info.level = colors.bold(info.level);
	}
	if (info.roomName) {
		info.roomName = colors.italic(info.roomName);
	}
	return info;
});

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss',
		}),
		myFormat
	),
	transports: [new transports.File({ filename: process.env.LOG_FILE || "./logs/ott.log" })],
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(new transports.Console({
		format: format.combine(
			customColorizer(),
			myFormat
		),
	}));
}
else {
	logger.add(new transports.Console({
		format: format.combine(
			myFormat
		),
	}));
}

module.exports = {
	getLogger(namespace) {
		return logger.child({ namespace });
	},
};
