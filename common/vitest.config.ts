/// <reference types="vitest" />
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [...configDefaults.exclude, "ts-out"],
		coverage: {
			exclude: [...(configDefaults.coverage.exclude ?? []), "**/*.spec-d.ts"],
		},
		typecheck: {
			enabled: true,
			include: ["**/*.spec-d.ts"],
		},
	},
});
