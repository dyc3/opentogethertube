import { defineConfig, searchForWorkspaceRoot } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import path from "path";
import child_process from "child_process";

function gitCommit() {
	if (process.env.GIT_COMMIT) {
		return process.env.GIT_COMMIT.trim();
	}
	try {
		return child_process.execSync("git rev-parse --short HEAD").toString().trim();
	} catch (e) {
		// eslint-disable-next-line no-console
		console.warn("Failed to get git commit hash");
		return "unknown";
	}
}
// https://vitejs.dev/config/
export default defineConfig({
	define: {
		__COMMIT_HASH__: JSON.stringify(gitCommit()),
	},
	base: process.env.OTT_BASE_URL || "/",
	plugins: [
		vue(),
		vuetify({
			autoImport: true,
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
		],
	},
	test: {
		environment: "jsdom",
		server: {
			deps: {
				inline: ["vuetify"],
			},
		},
	},
});
