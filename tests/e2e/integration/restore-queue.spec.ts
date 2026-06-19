import { v4 as uuid } from "uuid";
import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("Restore queue", () => {
	beforeEach(async ({ context, ott }) => {
		await context.clearCookies();
		await ott.ensureToken();
		await ott.resetRateLimit();
		await ott.request({
			method: "POST",
			url: "/api/dev/set-admin-api-key",
			body: { newkey: ott.apiKey },
		});
	});

	it("should restore the previous queue while keeping the dialog usable", async ({
		page,
		ott,
	}) => {
		page.on("pageerror", () => {
			// Restored fake videos have no real source; ignore the resulting player errors.
		});

		const roomName = uuid().substring(0, 20);

		// Create a permanent room, unload it so nothing shadows storage, then seed a
		// previous queue directly into storage. Reopening the room loads this
		// prevQueue from the database, which is what powers the restore prompt.
		await ott.request({
			method: "POST",
			url: "/api/room/create",
			body: { name: roomName, isTemporary: false },
		});
		await ott.request({
			method: "DELETE",
			url: `/api/room/${roomName}`,
			headers: { apikey: ott.apiKey },
		});
		await ott.request({
			method: "POST",
			url: `/api/dev/room/${roomName}/seed-prev-queue`,
			body: { count: 4 },
		});

		// Use a short viewport so the dialog's scroll cap is what keeps the action
		// buttons reachable. Without the cap, a 4-item list pushes them off-screen.
		await page.setViewportSize({ width: 1280, height: 500 });
		await page.goto(`/room/${roomName}`);
		await expect(page.locator("#connectStatus")).toHaveText("Connected");

		// The restore prompt should appear and open a dialog listing the previous items.
		await expect(page.locator("[data-cy=restore-banner]")).toBeVisible();
		await page.locator("[data-cy=restore-show]").click();
		await expect(page.locator("[data-cy=restore-dialog]")).toBeVisible();
		await expect(page.locator("[data-cy=restore-dialog] .video")).toHaveCount(4);

		// The action buttons must stay fully within the viewport regardless of how
		// long the previous queue is. This guards the UI regression being fixed.
		await expect(page.locator("[data-cy=restore-confirm]")).toBeInViewport({ ratio: 1 });
		await expect(page.locator("[data-cy=restore-discard]")).toBeInViewport({ ratio: 1 });

		// Restoring enqueues the previous videos and dismisses the prompt.
		await page.locator("[data-cy=restore-confirm]").click();
		await expect(page.locator("[data-cy=restore-banner]")).toHaveCount(0);
		// One video becomes the current source; the remaining three stay queued.
		await expect(page.locator(".video-queue .video")).toHaveCount(3);
	});
});
