import { defineConfig } from "vite";
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
				configFile: "src/vuetify-settings.scss",
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"common": path.resolve(__dirname, "../common"),
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
	test: {
		environment: "jsdom",
		deps: {
			inline: ["vuetify"],
		},
	},
});
