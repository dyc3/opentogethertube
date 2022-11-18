import { defineConfig } from "cypress";

export default defineConfig({
	projectId: "3utpz8",
	downloadsFolder: "tests/e2e/downloads",
	fixturesFolder: "tests/e2e/fixtures",
	screenshotsFolder: "tests/e2e/screenshots",
	videosFolder: "tests/e2e/videos",

	component: {
		supportFile: "tests/e2e/support/component.ts",
		indexHtmlFile: "tests/e2e/support/component-index.html",
		specPattern: "tests/e2e/component/**/*.cy.{js,ts}",

		devServer: {
			framework: "vue",
			bundler: "vite",
		},
	},
});
