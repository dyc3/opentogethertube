import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e/integration",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 3 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: "http://localhost:8080",
		viewport: { width: 1280, height: 720 },
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "yarn start:e2e",
		url: "http://localhost:8080/api/status",
		timeout: 120_000,
		reuseExistingServer: !process.env.CI,
	},
});
