const { createLogger, format, transports } = require('winston');

const myFormat = format.printf(({ level, message, timestamp, namespace }) => {
	return `${timestamp} [${namespace}] ${level}: ${message}`;
});

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss',
		}),
		myFormat
	),
	transports: [new transports.File({ filename: "opentogethertube.log" })],
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(new transports.Console({
		format: format.combine(
			format.colorize({ level: true }),
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
