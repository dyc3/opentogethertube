const { getLogger } = require('./logger.js');
const securePassword = require('secure-password');
const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const { User } = require("./models");

const pwd = securePassword();
const log = getLogger("usermanager");
const router = express.Router();

router.post("/login", passport.authenticate("local"), (req, res) => {
	if (req.user) {
		delete req.session.username;
		req.session.save();
		res.json({
			success: true,
			user: req.user,
		});
	}
	else {
		res.status(401).json({
			success: false,
		});
	}
});

router.post("/logout", (req, res) => {
	if (req.user) {
		req.logout();
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

router.post("/register", (req, res) => {
	usermanager.registerUser(req.body).then(result => {
		req.login(result.user, () => {
			delete req.session.username;
			req.session.save();
			res.json(result);
		});
	}).catch(err => {
		log.error(`Unable to register user ${err} ${err.message}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "An unknown error occurred. Try again later.",
			},
		});
	});
});

let usermanager = {
	router,

	/**
	 * Callback used by passport LocalStrategy to authenticate Users.
	 */
	async authCallback(email, password, done) {
		// HACK: required to use usermanager inside passport callbacks that are inside usermanager. This is because `this` becomes `global` inside these callbacks for some fucking reason
		let usermanager = require("./usermanager.js");
		if (process.env.NODE_ENV !== 'production') {
			if (email === "test@localhost" && password === "test") {
				done(null, await usermanager.getUser({ email }));
				return;
			}
		}
		let user = await usermanager.getUser({ email });
		let result = await pwd.verify(user.salt + password, Buffer.from(user.hash));
		switch (result) {
			case securePassword.INVALID_UNRECOGNIZED_HASH:
				log.error(`${email}: Unrecognized hash. I don't think this should ever happen.`);
				done(null, false);
				break;
			case securePassword.INVALID:
				log.error(`${email}: Hash is invalid`);
				done(null, false);
				break;
			case securePassword.VALID_NEEDS_REHASH:
				log.info(`${email}: Hash is valid, needs rehash`);
				user.hash = await pwd.hash(Buffer.from(user.salt + password));

				// TODO: save User to database
			// eslint-disable-next-line no-fallthrough
			case securePassword.VALID:
				log.info(`${email}: Hash is valid`);
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
		let user = await usermanager.getUser({ id });
		done(null, user);
	},

	async registerUser({ email, username, password }) {
		let salt = crypto.randomBytes(256).toString('base64');
		let hash = await pwd.hash(Buffer.from(salt + password));

		return User.create({
			email,
			username,
			salt,
			hash,
		}).then(user => {
			return {
				success: true,
				user,
			};
		}).catch(err => {
			log.error(`Failed to create new user in the database: ${err} ${err.message}`);
			return {
				success: false,
			};
		});
	},

	/**
	 * Gets a User based on either their email or id.
	 * @param {*} param0
	 * @returns Promise<User>
	 */
	async getUser({ email, id }) {
		// TODO: get User from database
		if (process.env.NODE_ENV !== 'production' && (email === "test@localhost" || id === -1)) {
			return Promise.resolve(User.build({ id: -1, email, username: "test user" }));
		}
	},
};

module.exports = usermanager;
