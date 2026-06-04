import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("Room events", () => {
	beforeEach(async ({ page, ott }) => {
		page.on("pageerror", () => {
			// Embedded player scripts can throw after load; these tests assert our UI state.
		});
		await ott.ensureToken();
		await ott.resetRateLimit();
		const response = await ott.request({ method: "POST", url: "/api/room/generate" });
		const body = await response.json();
		await page.goto(`/room/${body.room}`);
	});

	it("should show toasts when adding a video and skipping it", async ({ page }) => {
		await page.getByRole("button", { name: "Add a video" }).click();
		await page
			.locator('[data-cy="add-preview-input"]')
			.fill("https://vjs.zencdn.net/v/oceans.mp4");
		await page.locator(".video button").nth(1).click();
		await expect(page.locator(".toast", { hasText: "added oceans" })).toBeVisible();
		await expect(page.locator("video")).toBeVisible();

		await page.getByLabel("Next video").click();
		await expect(page.locator(".toast", { hasText: "skipped oceans" })).toBeVisible();
	});
});
