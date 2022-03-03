module.exports = {
	env: {
		node: true,
		es6: true,
	},
	rules: {
		"no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
		"no-debugger": "error",
		"curly": ["error", "all"],
		"no-eval": ["error", {}],
		"no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0 }],
		"no-var": "error",
		"no-dupe-keys": "error",
		"no-prototype-builtins": "error",
		"prefer-arrow-callback": "error",
		"eol-last": ["error", "always"],
		"eqeqeq": ["error", "always"],
		"no-unused-vars": process.env.NODE_ENV === "production" ? "error" : "warn",

		"@typescript-eslint/no-var-requires": "warn",
	},
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
	},
	overrides: [
		{
			files: ["*.js"],
			rules: {
				"@typescript-eslint/explicit-module-boundary-types": "off",
				"@typescript-eslint/no-var-requires": "off",
				"@typescript-eslint/no-unused-vars": "off",
			},
		},
		{
			files: ["*.ts", "*.tsx"],
			parser: "@typescript-eslint/parser",
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: "module",
				project: ["./tsconfig.json"],
			},
			rules: {
				"no-unused-vars": "off",
				"@typescript-eslint/adjacent-overload-signatures": "error",
				"@typescript-eslint/switch-exhaustiveness-check": "error",
				"@typescript-eslint/restrict-template-expressions": "warn",
				"@typescript-eslint/no-unnecessary-type-assertion": "warn",
				"@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",

				"@typescript-eslint/no-unsafe-call": "off", // TODO: switch to warn
				"@typescript-eslint/no-unsafe-member-access": "off", // TODO: switch to warn
				"@typescript-eslint/no-unsafe-assignment": "off", // TODO: switch to warn
			},
		},
		{
			files: ["migrations/**"],
			rules: {
				"no-unused-vars": "off",
				"@typescript-eslint/no-unused-vars": "off",
			},
		},
	],
};
