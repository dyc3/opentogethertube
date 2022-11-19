module.exports = {
	plugins: ["cypress"],
	env: {
		"jest": false,
		"mocha": true,
		"cypress/globals": true,
	},
	extends: ["plugin:cypress/recommended"],
	rules: {
		"strict": "off",
		"jest/expect-expect": "off",
	},
};
