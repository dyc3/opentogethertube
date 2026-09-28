import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./database/schema/postgres.ts",
	out: "./database/migrations/postgres",
});
