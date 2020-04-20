const { getLogger } = require('./logger.js');
const _ = require("lodash");
const securePassword = require('secure-password');
const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const rateLimit = require("express-rate-limit");
const RateLimitStore = require('rate-limit-redis');
const { User } = require("./models");
const roommanager = require("./roommanager");

const pwd = securePassword();
const log = getLogger("usermanager");
const router = express.Router();
let redisClient;

router.get("/", (req, res) => {
	if (req.user) {
		let user = {
			username: req.user.username,
			loggedIn: true,
		};
		res.json(user);
	}
	else {
		res.json({
			username: req.session.username,
			loggedIn: false,
		});
	}
});

router.post("/", async (req, res) => {
	if (!req.body.username) {
		res.status(400).json({
			success: false,
			error: {
				message: "Missing argument (username)",
			},
		});
		return;
	}
	let oldUsername;
	if (req.user) {
		oldUsername = req.user.username;
		req.user.username = req.body.username;
		try {
			await req.user.save();
		}
		catch (err) {
			if (err.name === "SequelizeUniqueConstraintError") {
				await req.user.reload();
				res.status(400).json({
					success: false,
					error: {
						name: "UsernameTaken",
						message: "Somebody else is already using that username.",
					},
				});
				return;
			}
			else {
				log.error(`Unknown error occurred when saving user to database ${err.message}`);
				res.status(500).json({
					success: false,
					error: {
						message: "An unknown error occurred.",
					},
				});
				return;
			}
		}
		res.json({
			success: true,
		});
	}
	else {
		oldUsername = req.session.username;
		req.session.username = req.body.username;
		req.session.save();
		res.json({
			success: true,
		});
	}
	log.info(`${oldUsername} changed username to ${req.body.username}`);
	usermanager.onUserModified(req.session);
});

let logInLimiter = rateLimit({ store: new RateLimitStore({ client: redisClient, resetExpiryOnChange: true, prefix: "rl:UserRegister" }), windowMs: 10 * 1000, max: 5, message: "You are doing that too much." });
router.post("/login", process.env.NODE_ENV === "production" ? logInLimiter : (req, res, next) => next(), (req, res, next) => {
	passport.authenticate("local", (err, user) => {
		if (err) {
			res.status(401).json({
				success: false,
				error: {
					message: err.message,
				},
			});
			return;
		}
		if (user) {
			req.login(user, (err) => {
				if (err) {
					log.error("Unknown error when logging in");
					res.status(500).json({
						success: false,
						error: {
							message: "An unknown error occurred when logging in.",
						},
					});
					return;
				}
				req.session.save();
				try {
					usermanager.onUserLogIn(user, req.session);
				}
				catch (err) {
					log.error(`An unknown error occurred when running onUserLogIn: ${err} ${err.message}`);
				}
				res.json({
					success: true,
					user: _.pick(user, [
						"email",
						"username",
					]),
				});
			});
		}
		else {
			res.status(401).json({
				success: false,
				error: {
					message: "Either the email or password was not provided.",
				},
			});
		}
	})(req, res, next);
});

router.post("/logout", (req, res) => {
	if (req.user) {
		let user = req.user;
		req.logout();
		usermanager.onUserLogOut(user, req.session);
		res.json({
			success: true,
		});
	}
	else {
		res.json({
			success: false,
			error: {
				message: "Not logged in.",
			},
		});
	}
});

let registerLimiter = rateLimit({ store: new RateLimitStore({ client: redisClient, resetExpiryOnChange: true, prefix: "rl:UserRegister" }), windowMs: 60 * 60 * 1000, max: 4, message: "You are doing that too much." });
router.post("/register", process.env.NODE_ENV === "production" ? registerLimiter : (req, res, next) => next(), (req, res) => {
	usermanager.registerUser(req.body).then(result => {
		req.login(result, () => {
			try {
				usermanager.onUserLogIn(result, req.session);
			}
			catch (err) {
				log.error(`An unknown error occurred when running onUserLogIn: ${err} ${err.message}`);
			}
			res.json({
				success: true,
				user: _.pick(result, [
					"email",
					"username",
				]),
			});
		});
	}).catch(err => {
		log.error(`Unable to register user ${err} ${err.message}`);
		if (err.name === "SequelizeUniqueConstraintError") {
			let fields = err.fields.join(", ");
			fields = fields.charAt(0).toUpperCase() + fields.slice(1);
			res.status(400).json({
				success: false,
				error: {
					name: "AlreadyInUse",
					fields: err.fields,
					message: `${fields} ${err.fields.length > 1 ? "are" : "is"} already in use.`,
				},
			});
		}
		else if (err.name === "SequelizeValidationError" || err.name === "BadPasswordError") {
			res.status(400).json({
				success: false,
				error: {
					name: "ValidationError",
					message: err.message,
				},
			});
		}
		else {
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "An unknown error occurred. Try again later.",
				},
			});
		}
	});
});

class BadPasswordError extends Error {
	constructor() {
		super("Password does not meet minimum requirements. Must be at least 8 characters long, and contain 2 of the following categories of characters: lowercase letters, uppercase letters, numbers, special characters.");
		this.name = "BadPasswordError";
	}
}

let usermanager = {
	router,

	init(_redisClient) {
		redisClient = _redisClient;
	},

	/**
	 * Callback used by passport LocalStrategy to authenticate Users.
	 */
	async authCallback(email, password, done) {
		// HACK: required to use usermanager inside passport callbacks that are inside usermanager. This is because `this` becomes `global` inside these callbacks for some fucking reason
		let usermanager = require("./usermanager.js");
		// if (process.env.NODE_ENV !== 'production') {
		// 	if (email === "test@localhost" && password === "test") {
		// 		done(null, await usermanager.getUser({ email }));
		// 		return;
		// 	}
		// }
		let user;
		try {
			user = await usermanager.getUser({ email });
		}
		catch (err) {
			if (err.message === "User not found") {
				done(new Error("Email or password is incorrect."));
			}
			else {
				log.error(`Auth callback failed: ${err}`);
				done(new Error("An unknown error occurred. This is a bug."));
			}
			return;
		}
		// eslint-disable-next-line array-bracket-newline
		let result = await pwd.verify(Buffer.concat([user.salt, Buffer.from(password)]), Buffer.from(user.hash));
		switch (result) {
			case securePassword.INVALID_UNRECOGNIZED_HASH:
				log.error(`${email}: Unrecognized hash. I don't think this should ever happen.`);
				done(null, false);
				break;
			case securePassword.INVALID:
				log.debug(`${email}: Hash is invalid`);
				done(new Error("Email or password is incorrect."), false);
				break;
			case securePassword.VALID_NEEDS_REHASH:
				log.debug(`${email}: Hash is valid, needs rehash`);
				// eslint-disable-next-line array-bracket-newline
				user.hash = await pwd.hash(Buffer.concat([user.salt, Buffer.from(password)]));
				await user.save();
			// eslint-disable-next-line no-fallthrough
			case securePassword.VALID:
				log.debug(`${email}: Hash is valid`);
				done(null, user);
				break;

			default:
				break;
		}
	},

	/**
	 * Converts a User into their user id.
	 * Used for persistent session storage.
	 */
	serializeUser(user, done) {
		done(null, user.id);
	},

	/**
	 * Converts a user id into a User.
	 * Used for persistent session storage.
	 */
	async deserializeUser(id, done) {
		// HACK: required to use usermanager inside passport callbacks that are inside usermanager. This is because `this` becomes `global` inside these callbacks for some fucking reason
		let usermanager = require("./usermanager.js");
		try {
			let user = await usermanager.getUser({ id });
			done(null, user);
		}
		catch (err) {
			log.error(`Unable to deserialize user id=${id} ${err}`);
			done(err, false);
		}
	},

	/**
	 * Middleware to handle errors in serialize and deserialize callbacks
	 */
	passportErrorHandler(err, req, res, next) {
		if (err) {
			log.error(`Error in middleware ${err}, logging user out.`);
			req.logout();
			req.session.save();
			next();
		}
		else {
			next();
		}
	},

	async registerUser({ email, username, password }) {
		if (!this.isPasswordValid(password)) {
			return Promise.reject(new BadPasswordError());
		}

		let salt = crypto.randomBytes(128);
		// eslint-disable-next-line array-bracket-newline
		let hash = await pwd.hash(Buffer.concat([salt, Buffer.from(password)]));

		return User.create({
			email,
			username,
			salt,
			hash,
		}).then(user => {
			return user;
		}).catch(err => {
			log.error(`Failed to create new user in the database: ${err} ${err.message}`);
			throw err;
		});
	},

	/**
	 * Gets a User based on either their email or id.
	 * @param {*} param0
	 * @returns Promise<User>
	 */
	async getUser({ email, id }) {
		if (!email && !id) {
			log.error("Invalid parameters to find user");
			throw new Error("Invalid parameters to find user");
		}
		// if (process.env.NODE_ENV !== 'production' && (email === "test@localhost" || id === -1)) {
		// 	return Promise.resolve(User.build({ id: -1, email, username: "test user" }));
		// }
		let where = {};
		if (email) {
			where = { email };
		}
		else if (id) {
			where = { id };
		}
		return User.findOne({ where }).then(user => {
			if (!user) {
				log.error("User not found");
				throw new Error("User not found");
			}
			return user;
		});
	},

	isPasswordValid(password) {
		if (process.env.NODE_ENV === "development" && password === "1") {
			return true;
		}
		let conditions = [
			!!/^(?=.*[a-z])/.exec(password),
			!!/^(?=.*[A-Z])/.exec(password),
			!!/^(?=.*[0-9])/.exec(password),
			!!/^(?=.*[!@#$%^&*])/.exec(password),
		];
		return conditions.reduce((acc, curr) => acc + curr) >= 2 && !!/^(?=.{8,})/.exec(password);
	},

	onUserLogIn(user, session) {
		log.info(`${user.username} (id: ${user.id}) has logged in.`);
		for (let room of roommanager.rooms) {
			for (let client of room.clients) {
				if (client.session.id === session.id) {
					client.user = user;
					room._dirtyProps.push("users");
					break;
				}
			}
		}
	},

	onUserLogOut(user, session) {
		log.info(`${user.username} (id: ${user.id}) has logged out.`);
		for (let room of roommanager.rooms) {
			for (let client of room.clients) {
				if (client.session.id === session.id) {
					client.user = null;
					room._dirtyProps.push("users");
					break;
				}
			}
		}
	},

	onUserModified(session) {
		for (let room of roommanager.rooms) {
			for (let client of room.clients) {
				if (client.session.id === session.id) {
					if (client.isLoggedIn) {
						client.user.reload();
					}
					room._dirtyProps.push("users");
					break;
				}
			}
		}
	},
};

if (process.env.NODE_ENV === "test") {
	usermanager.registerUser({
		email: "forced@localhost",
		username: "forced test user",
		password: "test1234",
	}).catch(err => {
		log.warn(`failed to register test user ${err.message}`);
	});

	usermanager.registerUser({
		email: "test@localhost",
		username: "test user",
		password: "test1234",
	}).catch(err => {
		log.warn(`failed to register test user ${err.message}`);
	});

	router.get("/test/forceLogin", async (req, res) => {
		req.login(await usermanager.getUser({ email: "forced@localhost" }), (err) => {
			res.json({
				success: !!err,
			});
		});
	});
}

module.exports = usermanager;
