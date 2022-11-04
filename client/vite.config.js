import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [vue()],
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
});
