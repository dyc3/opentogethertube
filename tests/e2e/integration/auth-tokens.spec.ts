import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("Auth tokens", () => {
	beforeEach(async ({ context }) => {
		await context.clearCookies();
	});

	it("should request a new auth token on page load and save it to localstorage", async ({
		page,
	}) => {
		await page.goto("/");
		await expect.poll(() => page.evaluate(() => window.localStorage.token)).toBeDefined();
	});
});
