/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [...configDefaults.exclude, "ts-out"],
		pool: "forks",
		setupFiles: ["./tests/unit/jest.setup.redis-mock.js"],
		coverage: {
			exclude: [
				...(configDefaults.coverage.exclude ?? []),
				"config/**",
				"migrations/**",
				"**/tests/**",
				"**/common/**",
				"**/*.spec-d.ts",
			],
		},
		typecheck: {
			enabled: true,
			include: ["**/*.spec-d.ts"],
		},
	},
});
