import { defineConfig } from "cypress";

export default defineConfig({
	projectId: "3utpz8",
	downloadsFolder: "tests/e2e/downloads",
	fixturesFolder: "tests/e2e/fixtures",
	screenshotsFolder: "tests/e2e/screenshots",
	videosFolder: "tests/e2e/videos",
	viewportWidth: 1280,
	viewportHeight: 720,
	chromeWebSecurity: false,
	env: {
		OTT_API_KEY: `TESTAPIKEY-abcdefghijklmnopqrstuvwxyz`,
	},
	e2e: {
		baseUrl: "http://localhost:8080/",
		specPattern: "tests/e2e/integration/**/*.{js,jsx,ts,tsx}",
		supportFile: "tests/e2e/support/index.ts",
		excludeSpecPattern: "tests/e2e/integration/examples/**",
		retries: {
			runMode: 3,
		},
		experimentalRunAllSpecs: true,
	},
});
