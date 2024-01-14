export default {
	moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "vue"],
	transform: {
		"^.+\\.tsx?$": "ts-jest",
		"^.+\\.jsx?$": "babel-jest",
	},
	rootDir: "../..",
	testMatch: ["**/tests/unit/**/*.spec.(js|ts)|**/__tests__/*.(js|ts)"],
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/", "/ts-out/"],
	watchPlugins: ["jest-watch-typeahead/filename", "jest-watch-typeahead/testname"],
	collectCoverage: true,
	coverageReporters: ["text-summary", "text", "json", "html"],
	collectCoverageFrom: [
		"**/*.{js,ts}",
		"!**/node_modules/**",
		"!**/dist/**",
		"!**/*.config.js",
		"!**/*.eslintrc.js",
		"!**/coverage/**",
		"!**/tests/**",
	],
};
