import { defineConfig } from "cypress";
import viteConfig from "./client/vite.config";

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
	component: {
		supportFile: "client/tests/e2e/support/component.ts",
		indexHtmlFile: "client/tests/e2e/support/component-index.html",
		specPattern: "client/tests/e2e/component/**/*.cy.{js,ts}",
		retries: {
			runMode: 3,
		},

		devServer: {
			framework: "vue",
			bundler: "vite",
			viteConfig: {
				...viteConfig,
				// this attempts to mitigate https://github.com/cypress-io/cypress/issues/25913
				optimizeDeps: {
					include: [
						"vuetify/lib/components/VApp/index.mjs",
						"vuetify/lib/components/VAppBar/index.mjs",
						"vuetify/lib/components/VBtn/index.mjs",
						"vuetify/lib/components/VDialog/index.mjs",
						"vuetify/lib/components/VFooter/index.mjs",
						"vuetify/lib/components/VGrid/index.mjs",
						"vuetify/lib/components/VIcon/index.mjs",
						"vuetify/lib/components/VImg/index.mjs",
						"vuetify/lib/components/VList/index.mjs",
						"vuetify/lib/components/VMain/index.mjs",
						"vuetify/lib/components/VMenu/index.mjs",
						"vuetify/lib/components/VNavigationDrawer/index.mjs",
						"vuetify/lib/components/VOverlay/index.mjs",
						"vuetify/lib/components/VProgressCircular/index.mjs",
						"vuetify/lib/components/VToolbar/index.mjs",
						"vuetify/lib/components/VCard/index.mjs",
						"vuetify/lib/components/VForm/index.mjs",
						"vuetify/lib/components/VSelect/index.mjs",
						"vuetify/lib/components/VTextField/index.mjs",
						"vuetify/lib/components/VDivider/index.mjs",
						"vuetify/lib/components/VSheet/index.mjs",
						"vuetify/lib/components/VTabs/index.mjs",
						"vuetify/lib/components/VWindow/index.mjs",
						"vuetify/lib/components/VTooltip/index.mjs",
						"vuetify/lib/components/VChip/index.mjs",
						"vuetify/lib/components/VTextarea/index.mjs",
						"vuetify/lib/components/VCheckbox/index.mjs",
						"vuetify/lib/components/VSlider/index.mjs",
						"vuetify/lib/components/VThemeProvider/index.mjs",
						"vuetify/lib/components/VBanner/index.mjs",
						"vuetify/lib/components/VTable/index.mjs",
					],
				},
			},
		},
	},
});
