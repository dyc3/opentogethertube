/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [...configDefaults.exclude, "ts-out"],
		typecheck: {
			enabled: true,
			include: ["**/*.spec-d.ts"],
		},
	},
});
