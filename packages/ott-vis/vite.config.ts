/// <reference types="vitest" />
import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		exclude: [...configDefaults.exclude, "ts-out"],
		setupFiles: ["./jest-setup.js"],
	},
});
