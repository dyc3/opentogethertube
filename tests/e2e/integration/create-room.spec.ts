import faker from "faker";
import type { Page } from "@playwright/test";
import { v4 as uuid } from "uuid";
import { beforeEach, describe, expect, it } from "../support/fixtures";

const ROOM_URL_PATTERN = /room/;
const OWNER_CLASS_PATTERN = /role-owner/;

describe("Creating Rooms", () => {
	async function openCreateRoomMenu(page: Page) {
		await page.getByRole("banner").getByRole("button", { name: "Create Room" }).click();
	}

	beforeEach(async ({ context, ott }) => {
		await context.clearCookies();
		await ott.ensureToken();
		await ott.resetRateLimit();
	});

	it("should create a temporary room", async ({ page }) => {
		await page.goto("/");
		await openCreateRoomMenu(page);
		await page.getByText("Create Temporary Room", { exact: true }).click();
		await expect(page).toHaveURL(ROOM_URL_PATTERN);
		await expect(page.locator("h1", { hasText: "Temporary Room" })).toHaveText(
			"Temporary Room",
		);
		await expect(page.locator("#connectStatus")).toHaveText("Connected");
	});

	it("should create a permanent room", async ({ page }) => {
		await page.goto("/");
		await openCreateRoomMenu(page);
		await page.getByText("Create Permanent Room", { exact: true }).click();

		const roomName = uuid().substring(0, 20);
		await page.locator("form input").first().fill(roomName);
		await page.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());

		await expect(page).toHaveURL(ROOM_URL_PATTERN);
		await expect(page.locator("h1", { hasText: roomName })).toHaveText(roomName);
		await expect(page.locator("#connectStatus")).toHaveText("Connected");
	});

	it("should create a permanent room, unload it, and be able to load it back up", async ({
		page,
		ott,
	}) => {
		await ott.request({
			method: "POST",
			url: "/api/dev/set-admin-api-key",
			body: { newkey: ott.apiKey },
		});
		await page.goto("/");
		await openCreateRoomMenu(page);
		await page.getByText("Create Permanent Room", { exact: true }).click();

		const roomName = uuid().substring(0, 20);
		await page.locator("form input").first().fill(roomName);
		await page.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());
		await expect(page).toHaveURL(ROOM_URL_PATTERN);

		await page.goto("/");
		await ott.request({
			method: "DELETE",
			url: `/api/room/${roomName}`,
			headers: { apikey: ott.apiKey },
		});

		await page.goto(`/room/${roomName}`);
		await expect(page.locator("#connectStatus")).toHaveText("Connected");
	});

	describe("Room Ownership", () => {
		let userCreds: { email: string; username: string; password: string };

		beforeEach(async ({ context, page, ott }) => {
			await context.clearCookies();
			await ott.ensureToken();
			await ott.request({ method: "POST", url: "/api/dev/reset-rate-limit/user" });
			userCreds = {
				email: faker.internet.email(),
				username: faker.internet.userName(),
				password: faker.internet.password(12),
			};
			await ott.createUser(userCreds);
			await ott.resetRateLimit();
			await page.reload();
		});

		async function createRoom(page: Page) {
			await page.goto("/");
			await openCreateRoomMenu(page);
			await page.getByText("Create Permanent Room", { exact: true }).click();

			const roomName = uuid().substring(0, 20);
			await page.locator("form input").first().fill(roomName);
			await page.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());
			await expect(page).toHaveURL(ROOM_URL_PATTERN);
		}

		async function checkPermissionsEditor(page: Page) {
			await expect(page.getByText("Permissions Editor").locator("..")).toContainText(
				"Viewing as: Owner",
			);
		}

		it("should create a room then claim", async ({ page, ott }) => {
			await createRoom(page);
			await ott.login(userCreds);
			await page.reload();

			await page.getByText("Settings").click();
			const claimRoom = page.getByRole("button", { name: "Claim Room" });
			if (await claimRoom.isVisible()) {
				await claimRoom.click();
			}
			await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
			await checkPermissionsEditor(page);
		});

		it("should create a room that is already claimed", async ({ page, ott }) => {
			await ott.login(userCreds);
			await page.reload();

			await createRoom(page);
			await page.getByText("Settings").click();
			await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
			await expect(page.getByRole("button", { name: "Claim Room" })).not.toBeVisible();

			await expect(page.locator(".user")).toHaveClass(OWNER_CLASS_PATTERN);
			await checkPermissionsEditor(page);
		});
	});
});
