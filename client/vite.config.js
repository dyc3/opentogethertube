import { defineConfig, searchForWorkspaceRoot } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
	test: {
		environment: "jsdom",
		deps: {
			inline: ["vuetify"],
		},
	},
});
