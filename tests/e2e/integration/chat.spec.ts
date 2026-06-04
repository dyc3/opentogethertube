import type { Page } from "@playwright/test";
import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("Room chat", () => {
	beforeEach(async ({ page, ott }) => {
		await ott.ensureToken();
		await ott.resetRateLimit();
		const response = await ott.request({ method: "POST", url: "/api/room/generate" });
		const body = await response.json();
		await page.goto(`/room/${body.room}`);
		await expect(page.locator("#connectStatus")).toHaveText("Connected");
	});

	async function sendChatMessage(page: Page, message: string) {
		await page.locator('[data-cy="chat-activate"]').click();
		await page.locator('[data-cy="chat-input"]').fill(message);
		await page.locator('[data-cy="chat-input"]').press("Enter");
	}

	it("should send chat messages to all viewers in the room", async ({ browser, page, request }) => {
		const roomUrl = page.url();
		const tokenResponse = await request.get("/api/auth/grant");
		expect(tokenResponse.ok()).toBe(true);
		const tokenBody = await tokenResponse.json();

		const secondContext = await browser.newContext();
		await secondContext.addInitScript(token => {
			window.localStorage.setItem("token", token as string);
		}, tokenBody.token);
		const secondPage = await secondContext.newPage();

		try {
			await secondPage.goto(roomUrl);
			await expect(secondPage.locator("#connectStatus")).toHaveText("Connected");

			const message = `hello from e2e ${Date.now()}`;
			await sendChatMessage(page, message);

			await expect(page.locator(".message", { hasText: message })).toBeVisible();
			await expect(secondPage.locator(".message", { hasText: message })).toBeVisible();
		} finally {
			await secondContext.close();
		}
	});
});
