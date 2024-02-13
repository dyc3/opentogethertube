
/// <reference types="vitest" />
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [...configDefaults.exclude, "ts-out"],
		pool: "forks",
	},
});