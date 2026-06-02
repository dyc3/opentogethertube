import childProcess from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { createLogger, defineConfig, searchForWorkspaceRoot } from "vite";

const logger = createLogger();
const warn = logger.warn;

logger.warn = (message, options) => {
	// HACK: dashjs publishes an ESM entry with CommonJS wrapper code that floods build output.
	if (
		message.includes("COMMONJS_VARIABLE_IN_ESM") &&
		message.includes("dashjs/dist/modern/esm/dash.all.min.js")
	) {
		return;
	}

	warn(message, options);
};

function gitCommit() {
	if (process.env.GIT_COMMIT) {
		return process.env.GIT_COMMIT.trim();
	}
	try {
		return childProcess.execSync("git rev-parse --short HEAD").toString().trim();
		// biome-ignore lint/correctness/noUnusedVariables: biome migration
	} catch (e) {
		// eslint-disable-next-line no-console
		console.warn("Failed to get git commit hash");
		return "unknown";
	}
}
// https://vitejs.dev/config/
export default defineConfig({
	customLogger: logger,
	define: {
		__COMMIT_HASH__: JSON.stringify(gitCommit()),
	},
	base: process.env.OTT_BASE_URL || "/",
	plugins: [vue(), tailwindcss()],
	// css: {
	// 	preprocessorOptions: {
	// 		scss: {
	// 			// unfortunately, some of our dependencies use deprecated sass features, and we can't really do much about it
	// 			silenceDeprecations: ["import", "global-builtin"],
	// 			quietDeps: true,
	// 		},
	// 	},
	// },
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
	// optimizeDeps: {
	// 	// this attempts to mitigate https://github.com/cypress-io/cypress/issues/25913
	// 	entries: [
	// 		"tests/e2e/**/*.ts",
	// 		"client/tests/e2e/**/*.ts",
	// 		"tests/e2e/support/component.ts",
	// 		"client/tests/e2e/support/component.ts",
	// 		"**/*.{js,ts,vue}",
	// 	],
	// },
	test: {
		environment: "jsdom",
	},
});
