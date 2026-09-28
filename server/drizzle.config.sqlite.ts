import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./database/schema/sqlite.ts",
	out: "./database/migrations/sqlite",
});
