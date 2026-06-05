import { describe, expect, it, beforeEach } from "../support/fixtures";
import type { Locator, Page } from "@playwright/test";

const ROOM_URL_PATTERN = /room/;

async function openClientSettings(page: Page) {
	await expect(page).toHaveURL(ROOM_URL_PATTERN);
	await page.keyboard.press("Escape");
	await page.getByText("Preferences", { exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Preferences" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function selectTheme(page: Page, dialog: Locator, theme: string) {
	await dialog.getByText("Theme", { exact: true }).locator("..").getByRole("combobox").click();
	await page.getByRole("option", { name: theme, exact: true }).click();
}

async function savedTheme(page: Page) {
	return page.evaluate(() => JSON.parse(window.localStorage.getItem("settings") ?? "{}").theme);
}

describe("Client Settings", () => {
	beforeEach(async ({ page, ott }) => {
		await ott.ensureToken();
		await ott.resetRateLimit();
		const response = await ott.request({ method: "POST", url: "/api/room/generate" });
		const body = await response.json();
		await page.goto(`/room/${body.room}`);
	});

	it("previews and saves the selected theme", async ({ page, ott }) => {
		const dialog = await openClientSettings(page);

		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		await selectTheme(page, dialog, "light");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(dialog).not.toBeVisible();
		await expect.poll(() => savedTheme(page)).toBe("light");

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	});

	it("previews and restores the saved theme on cancel", async ({ page, ott }) => {
		const dialog = await openClientSettings(page);

		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		await selectTheme(page, dialog, "light");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		await expect.poll(() => savedTheme(page)).toBe("dark");
	});

	it("keeps default room settings visible in a short viewport", async ({ page, ott }) => {
		await page.setViewportSize({ width: 620, height: 560 });

		await page.getByRole("button", { name: "Preferences" }).click();
		const dialog = page.getByRole("dialog", { name: "Preferences" });
		await expect(dialog).toBeVisible();

		await dialog.getByRole("button", { name: "Default Room Settings" }).click();
		const sponsor = dialog.getByRole("checkbox", { name: "sponsor" });
		await expect(sponsor).toBeVisible();
		await sponsor.click();
		await expect(sponsor).not.toBeChecked();

		const adapterSelector = dialog.getByRole("checkbox", {
			name: "Show adapter selector (advanced)",
		});
		await expect(adapterSelector).toBeVisible();
		await adapterSelector.click();
		await expect(adapterSelector).toBeChecked();

		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(dialog).not.toBeVisible();
	});
});
