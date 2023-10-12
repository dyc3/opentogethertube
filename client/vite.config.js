import { defineConfig, searchForWorkspaceRoot } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
	base: process.env.OTT_BASE_URL || "/",
	plugins: [
		vue(),
		vuetify({
			autoImport: false,
			styles: {
				configFile: path.resolve(
					searchForWorkspaceRoot(process.cwd()),
					"client/src/vuetify-settings.scss"
				),
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(searchForWorkspaceRoot(process.cwd()), "client/src"),
		},
	},
	server: {
		port: 8080,
		proxy: {
			"^/api": {
				target: "http://localhost:3000",
				ws: true,
			},
		},
	},
	envDir: path.resolve(searchForWorkspaceRoot(process.cwd()), "env"),
	envPrefix: ["VITE_", "VUE_APP_", "OTT_"],
	optimizeDeps: {
		// this attempts to mitigate https://github.com/cypress-io/cypress/issues/25913
		entries: [
			"tests/e2e/**/*.ts",
			"client/tests/e2e/**/*.ts",
			"tests/e2e/support/component.ts",
			"client/tests/e2e/support/component.ts",
			"**/*.{js,ts,vue}",
			"vuetify/lib/components/**/*",
		],
		include: ["vuetify"],
	},
	test: {
		environment: "jsdom",
		deps: {
			inline: ["vuetify"],
		},
	},
});
