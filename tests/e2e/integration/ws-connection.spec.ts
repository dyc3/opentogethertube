import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("Websocket connection", () => {
	beforeEach(async ({ page, ott }) => {
		await ott.ensureToken();
		await ott.resetRateLimit();
		const response = await ott.request({ method: "POST", url: "/api/room/generate" });
		const body = await response.json();
		await page.goto(`/room/${body.room}`);
	});

	it("should connect to the websocket", async ({ page }) => {
		await expect(page.locator("#connectStatus")).toContainText("Connected");
	});

	it("should connect to the websocket on reconnect", async ({ page }) => {
		it.fixme(
			true,
			"Debug reconnect control is not exposed by the production build under Playwright yet.",
		);
		await expect(page.locator("#connectStatus")).toContainText("Connected");
		await page.evaluate(() => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					code: "F12",
					key: "F12",
					ctrlKey: true,
					shiftKey: true,
					bubbles: true,
				}),
			);
		});
		await expect(page.getByRole("button", { name: "Disconnect Me" })).toBeVisible();
		await page.getByRole("button", { name: "Disconnect Me" }).click();
		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(page.locator("#connectStatus")).toContainText("Connecting");
		await expect(page.locator("#connectStatus")).toContainText("Connected");
	});
});
