const { getLogger } = require('./logger.js');
const _ = require("lodash");
const securePassword = require('secure-password');
const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const rateLimit = require("express-rate-limit");
const RateLimitStore = require('rate-limit-redis');
const { User, Room } = require("./models");
const roommanager = require("./roommanager");
const { redisClient } = require('./redisclient.js');

const pwd = securePassword();
const log = getLogger("usermanager");
const router = express.Router();

router.get("/", (req, res) => {
	if (req.user) {
		let user = {
			username: req.user.username,
			loggedIn: true,
			discordLinked: !!req.user.discordId,
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
			// HACK: the unique constrait on the model is fucking broken
			if (await usermanager.isUsernameTaken(req.body.username)) {
				throw new UsernameTakenError();
			}
			await req.user.save();
		}
		catch (err) {
			if (err.name === "SequelizeUniqueConstraintError" || err.name === "UsernameTakenError") {
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
	usermanager.onUserModified(req.session, req.body.username);
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
		else if (err.name === "UsernameTakenError") {
			res.status(400).json({
				success: false,
				error: {
					name: "AlreadyInUse",
					fields: ["username"],
					message: "Username is already in use.",
				},
			});
		}
		else if (err.name === "EmailAlreadyInUseError") {
			res.status(400).json({
				success: false,
				error: {
					name: "AlreadyInUse",
					fields: ["email"],
					message: "Email is already associated with an account.",
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

router.get('/auth/discord', passport.authenticate('discord'));
router.get('/auth/discord/callback', passport.authenticate('discord', {
	failureRedirect: '/',
}), (req, res) => {
	log.info(`${req.user.username} logged in via social login.`);
	res.redirect('/'); // Successful auth
});

class BadPasswordError extends Error {
	constructor() {
		super("Password does not meet minimum requirements. Must be at least 8 characters long, and contain 2 of the following categories of characters: lowercase letters, uppercase letters, numbers, special characters.");
		this.name = "BadPasswordError";
	}
}

class UsernameTakenError extends Error {
	constructor() {
		super("Username taken.");
		this.name = "UsernameTakenError";
	}
}

class EmailAlreadyInUseError extends Error {
	constructor() {
		super("Email taken.");
		this.name = "EmailAlreadyInUseError";
	}
}

let usermanager = {
	router,

	/**
	 * Callback used by passport LocalStrategy to authenticate Users.
	 */
	async authCallback(email, password, done) {
		// HACK: required to use usermanager inside passport callbacks that are inside usermanager. This is because `this` becomes `global` inside these callbacks for some fucking reason
		let usermanager = require("./usermanager.js");
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

	async authCallbackDiscord(req, accessToken, refreshToken, profile, done) {
		// HACK: required to use usermanager inside passport callbacks that are inside usermanager. This is because `this` becomes `global` inside these callbacks for some fucking reason
		let usermanager = require("./usermanager.js");
		if (req.user) {
			log.info(`${req.user.username} already logged in, linking discord account...`);
			try {
				await usermanager.connectSocial(req.user, { discordId: profile.id });
				return done(null, req.user);
			}
			catch (err) {
				return done(err, req.user);
			}
		}
		try {
			let user = await usermanager.getUser({ discordId: profile.id });
			if (user) {
				return done(null, user);
			}
		}
		catch (e) {
			log.warn("Couldn't find existing user for discord profile, making a new one...");
			try {
				let user = await usermanager.registerUserSocial({ username: `${profile.username}#${profile.discriminator}`, discordId: profile.id });
				if (user) {
					return done(null, user);
				}
			}
			catch (error) {
				log.error(`Unable to create new social user: ${error}`);
				return done(error);
			}
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

		// HACK: the unique constrait on the model is fucking broken
		if (await this.isUsernameTaken(username)) {
			return Promise.reject(new UsernameTakenError());
		}
		if (await this.isEmailTaken(email)) {
			return Promise.reject(new EmailAlreadyInUseError());
		}

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

	async registerUserSocial({ username, discordId }) {
		let user = await User.create({
			discordId,
			username,
		});
		return user;
	},

	async connectSocial(user, options) {
		options = _.pick(options, "discordId");
		if (options) {
			user.discordId = options.discordId;
		}
		else {
			log.warn("Can't connect social logins, none were provided");
			return;
		}
		let socialUser = null;
		try {
			socialUser = await this.getUser(options);
			log.warn("Detected duplicate accounts for social login!");
		}
		catch (error) {
			log.info("No account merging required.");
		}
		if (socialUser) {
			if (socialUser.email || socialUser.salt || socialUser.hash) {
				log.error("Unable to merge accounts, local login credentials found in other account.");
				return Promise.reject("Unable to link accounts. Another account is linked to this discord account. Login credentials were found in the other account, so a merge could not be performed.");
			}
			log.warn(`Merging local account ${user.username} with social account ${socialUser.username}...`);
			// transfer all owned rooms to local account
			await Room.update({ ownerId: user.id }, { where: { ownerId: socialUser.id } });
			// delete old account
			await socialUser.destroy();
		}
		await user.save();

	},

	/**
	 * Gets a User based on either their email or id.
	 * @param {*} param0
	 * @returns Promise<User>
	 */
	async getUser({ email, id, discordId }) {
		if (!email && !id && !discordId) {
			log.error("Invalid parameters to find user");
			throw new Error("Invalid parameters to find user");
		}
		let where = {};
		if (email) {
			where = { email };
		}
		else if (id) {
			where = { id };
		}
		else if (discordId) {
			where = { discordId };
		}
		let user = await User.findOne({ where });
		if (!user) {
			log.error("User not found");
			throw new Error("User not found");
		}
		return user;
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

	onUserModified(session, newUsername=null) {
		for (let room of roommanager.rooms) {
			for (let client of room.clients) {
				if (client.session.id === session.id) {
					if (client.isLoggedIn) {
						client.user.reload();
					}
					else if (newUsername) {
						// HACK: used for unregistered users because for some reason the session doesn't want to update the username property
						client.username = newUsername;
					}
					room._dirtyProps.push("users");
					break;
				}
			}
		}
	},

	async isUsernameTaken(username) {
		// FIXME: remove when https://github.com/sequelize/sequelize/issues/12415 is fixed
		return await User.findOne({ where: { username }}).then(room => room ? true : false).catch(() => false);
	},

	async isEmailTaken(email) {
		// FIXME: remove when https://github.com/sequelize/sequelize/issues/12415 is fixed
		return await User.findOne({ where: { email }}).then(room => room ? true : false).catch(() => false);
	},
};

if (process.env.NODE_ENV === "test") {
	router.get("/test/forceLogin", async (req, res) => {
		req.login(await usermanager.getUser({ email: "forced@localhost" }), (err) => {
			res.json({
				success: !!err,
			});
		});
	});
}

module.exports = usermanager;
