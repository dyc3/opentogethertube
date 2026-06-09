import { afterEach, beforeEach, describe, expect, it } from "../support/fixtures";

describe("Room settings", () => {
	beforeEach(async ({ context, ott }) => {
		await context.clearCookies();
		await ott.ensureToken();
		await ott.resetRateLimit();
	});

	describe("Simple settings in temporary rooms", () => {
		beforeEach(async ({ page, ott }) => {
			const response = await ott.request({ method: "POST", url: "/api/room/generate" });
			const body = await response.json();
			const room = body.room as string;
			await page.goto(`/room/${room}`);
			const getRoom = page.waitForResponse(
				resp =>
					resp.url().includes(`/api/room/${room}`) && resp.request().method() === "GET",
			);
			await page.getByText("Settings").click();
			await getRoom;
			await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
			await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
		});

		afterEach(async ({ page }) => {
			await expect(page.getByText("Settings applied")).toBeVisible();
		});

		it("should apply title", async ({ page }) => {
			await page.locator('[data-cy="input-title"]').fill("ligma");
			await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
			await page.getByRole("button", { name: "Save" }).click();
			await expect(page.getByRole("heading", { name: "ligma" })).toBeVisible();
		});

		it("should apply description", async ({ page }) => {
			await page.locator('[data-cy="input-description"]').fill("sugma");
			await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
			await page.getByRole("button", { name: "Save" }).click();
		});

		it("should apply visibility", async ({ page }) => {
			await page.locator("[data-cy=select-visibility]").click();
			await page.getByText("Public", { exact: true }).click();
			await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
			await page.getByRole("button", { name: "Save" }).click();
		});

		it("should apply queue mode", async ({ page }) => {
			await page.locator("[data-cy=select-queueMode]").click();
			await page.getByText("Vote", { exact: true }).click();
			await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
			await page.getByRole("button", { name: "Save" }).click();
		});
	});
});
