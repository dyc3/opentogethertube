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
		fs: {
			// Allow serving files from one level up to the project root
			allow: [
				path.resolve(searchForWorkspaceRoot(process.cwd()), "node_modules"),
				path.resolve(searchForWorkspaceRoot(process.cwd()), "common"),
				path.resolve(searchForWorkspaceRoot(process.cwd()), "client"),
			],
		},
		port: 8080,
		proxy: {
			"^/api": {
				target: "http://localhost:3000",
				ws: true,
			},
		},
	},
	test: {
		environment: "jsdom",
		deps: {
			inline: ["vuetify"],
		},
	},
});
