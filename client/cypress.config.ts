import { defineConfig } from "cypress";
import viteConfig from "./vite.config.js";

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
	component: {
		supportFile: "tests/e2e/support/component.ts",
		indexHtmlFile: "tests/e2e/support/component-index.html",
		specPattern: "tests/e2e/component/**/*.cy.{js,ts}",
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
					// include: [
					// 	"vuetify/lib/components/VApp/index.mjs",
					// 	"vuetify/lib/components/VAppBar/index.mjs",
					// 	"vuetify/lib/components/VBtn/index.mjs",
					// 	"vuetify/lib/components/VDialog/index.mjs",
					// 	"vuetify/lib/components/VFooter/index.mjs",
					// 	"vuetify/lib/components/VGrid/index.mjs",
					// 	"vuetify/lib/components/VIcon/index.mjs",
					// 	"vuetify/lib/components/VImg/index.mjs",
					// 	"vuetify/lib/components/VList/index.mjs",
					// 	"vuetify/lib/components/VMain/index.mjs",
					// 	"vuetify/lib/components/VMenu/index.mjs",
					// 	"vuetify/lib/components/VNavigationDrawer/index.mjs",
					// 	"vuetify/lib/components/VOverlay/index.mjs",
					// 	"vuetify/lib/components/VProgressCircular/index.mjs",
					// 	"vuetify/lib/components/VToolbar/index.mjs",
					// 	"vuetify/lib/components/VCard/index.mjs",
					// 	"vuetify/lib/components/VForm/index.mjs",
					// 	"vuetify/lib/components/VSelect/index.mjs",
					// 	"vuetify/lib/components/VTextField/index.mjs",
					// 	"vuetify/lib/components/VDivider/index.mjs",
					// 	"vuetify/lib/components/VSheet/index.mjs",
					// 	"vuetify/lib/components/VTabs/index.mjs",
					// 	"vuetify/lib/components/VWindow/index.mjs",
					// 	"vuetify/lib/components/VTooltip/index.mjs",
					// 	"vuetify/lib/components/VChip/index.mjs",
					// 	"vuetify/lib/components/VTextarea/index.mjs",
					// 	"vuetify/lib/components/VCheckbox/index.mjs",
					// 	"vuetify/lib/components/VSlider/index.mjs",
					// 	"vuetify/lib/components/VThemeProvider/index.mjs",
					// 	"vuetify/lib/components/VBanner/index.mjs",
					// 	"vuetify/lib/components/VTable/index.mjs",
					// ],
					// Temporarily(?) exclude vuetify until we can find a better solution for
					// "Failed to fetch dynamically imported module" error in the component tests running on ci
					exclude: ["vuetify"],
				},
			},
		},
	},
});
