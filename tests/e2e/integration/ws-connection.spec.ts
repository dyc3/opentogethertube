import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("Websocket connection", () => {
	let roomName: string;

	beforeEach(async ({ page, ott }) => {
		await ott.ensureToken();
		await ott.resetRateLimit();
		const response = await ott.request({ method: "POST", url: "/api/room/generate" });
		const body = await response.json();
		roomName = body.room;
		await page.goto(`/room/${roomName}`);
	});

	it("should connect to the websocket", async ({ page }) => {
		await expect(page.locator("#connectStatus")).toContainText("Connected");
	});

	it("should connect to the websocket on reconnect", async ({ page, ott }) => {
		await expect(page.locator("#connectStatus")).toContainText("Connected");
		await ott.forceDisconnect(roomName);
		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(page.locator("#connectStatus")).toContainText("Connecting");
		await expect(page.locator("#connectStatus")).toContainText("Connected");
	});
});
