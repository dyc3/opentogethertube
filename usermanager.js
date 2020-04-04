const securePassword = require('secure-password');
const pwd = securePassword();

module.exports = {
	/**
	 * Callback used by passport LocalStrategy to authenticate Users.
	 */
	async authCallback(username, password, done) {
		let user = await this.getUser({ username });
		let result = await pwd.verify(password, user.hash);
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
	deserializeUser(id, done) {
		let user = this.getUser({ id });
		done(null, user);
	},

	async registerUser({ username, password }) {
		let hash = await pwd.hash(password);

		// TODO: save user in database
	},

	/**
	 * Gets a User based on either their username or id.
	 * @param {*} param0
	 */
	getUser({ username, id }) {
		// TODO: get User from database
	},
};
