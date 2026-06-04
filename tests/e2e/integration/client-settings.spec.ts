import { describe, expect, it } from "../support/fixtures";

describe("Client Settings", () => {
	it("keeps default room settings visible in a short viewport", async ({ page, ott }) => {
		await ott.ensureToken();
		await page.goto("/");
		await page.getByRole("banner").getByRole("button", { name: "Create Room" }).click();
		await page.getByText("Create Temporary Room", { exact: true }).click();
		await expect(page).toHaveURL(/room/);
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
