import faker from "faker";
import type { APIResponse, Page } from "@playwright/test";
import { beforeEach, describe, expect, it } from "../support/fixtures";

type OttApi = {
	request(options: { method?: string; url: string }): Promise<APIResponse>;
};

describe("Account management", () => {
	async function loginThroughUi(page: Page, user: string, password: string) {
		await page.goto("/");
		await page.locator('[data-cy="user-logged-out"]').click();
		await page.locator('[data-cy="login-user"]').fill(user);
		await page.locator('[data-cy="login-password"]').fill(password);
		await page.locator('[data-cy="login-button"]').click();
	}

	async function visitAccount(page: Page) {
		await page.goto("/account");
		await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
	}

	async function expectAccount(ott: OttApi, expected: Record<string, unknown>) {
		const response = await ott.request({ method: "GET", url: "/api/user/account" });
		await expect(await response.json()).toMatchObject(expected);
	}

	beforeEach(async ({ context, ott }) => {
		await context.clearCookies();
		await ott.ensureToken();
		await ott.resetRateLimit();
		await ott.request({ method: "POST", url: "/api/dev/reset-rate-limit/user" });
	});

	it("should redirect logged out users away from the account page", async ({ page }) => {
		await page.goto("/account");
		await expect(page).toHaveURL("/");
		await expect(page.locator('[data-cy="user-logged-out"]')).toBeVisible();
	});

	it("should let a password-only account add an email", async ({ page, ott }) => {
		const userCreds = {
			email: "",
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const newEmail = faker.internet.email();

		await ott.createUser(userCreds);
		await ott.login({ user: userCreds.username, password: userCreds.password });
		await visitAccount(page);

		await page.locator('[data-cy="account-email"]').fill(newEmail);
		await page.locator('[data-cy="account-save-email"]').click();
		await expect(page.locator('[data-cy="account-email"]')).toHaveValue(newEmail);
		await page.reload();
		await expect(page.locator('[data-cy="account-email"]')).toHaveValue(newEmail);
		await expectAccount(ott, { email: newEmail, username: userCreds.username });
	});

	it("should let an account with an email change it", async ({ page, ott }) => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const nextEmail = faker.internet.email();

		await ott.createUser(userCreds);
		await ott.login({ user: userCreds.username, password: userCreds.password });
		await visitAccount(page);

		await page.locator('[data-cy="account-email"]').fill(nextEmail);
		await page.locator('[data-cy="account-save-email"]').click();
		await expect(page.locator('[data-cy="account-email"]')).toHaveValue(nextEmail);
		await expectAccount(ott, { email: nextEmail, username: userCreds.username });
	});

	it("should show a link button for accounts without Discord linked", async ({ page, ott }) => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};

		await ott.createUser(userCreds);
		await ott.login({ user: userCreds.username, password: userCreds.password });
		await visitAccount(page);

		await expect(page.locator('[data-cy="account-link-discord"]')).toBeVisible();
		await expect(page.locator('[data-cy="account-unlink-discord"]')).toHaveCount(0);
		await expectAccount(ott, { discordLinked: false, username: userCreds.username });
	});

	it("should reject changing an email to one already in use", async ({ page, ott }) => {
		const existingEmail = faker.internet.email();
		const firstUser = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const secondUser = {
			email: existingEmail,
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};

		await ott.createUser(firstUser);
		await ott.createUser(secondUser);
		await ott.login({ user: firstUser.username, password: firstUser.password });
		await visitAccount(page);

		await page.locator('[data-cy="account-email"]').fill(existingEmail);
		await page.locator('[data-cy="account-save-email"]').click();
		await expect(page.getByText("Email is already associated with an account.")).toBeVisible();
		await expectAccount(ott, { email: firstUser.email, username: firstUser.username });
	});

	it("should let a social-only account add email and password, then log in with username/password", async ({
		page,
		ott,
	}) => {
		const username = faker.internet.userName();
		const email = faker.internet.email();
		const password = faker.internet.password(12);

		await ott.createSocialUser({ username });
		await ott.forceLogin(username);
		await visitAccount(page);

		await expect(page.locator('[data-cy="account-current-password"]')).toHaveCount(0);
		await page.locator('[data-cy="account-email"]').fill(email);
		await page.locator('[data-cy="account-save-email"]').click();
		await expect(page.locator('[data-cy="account-email"]')).toHaveValue(email);

		await page.locator('[data-cy="account-new-password"]').fill(password);
		await page.locator('[data-cy="account-new-password-confirm"]').fill(password);
		await page.locator('[data-cy="account-save-password"]').click();
		await page.reload();
		await expect(page.locator('[data-cy="account-current-password"]')).toBeVisible();
		await expectAccount(ott, { email, username, hasPassword: true, discordLinked: true });

		await page.context().clearCookies();
		await ott.ensureToken();
		await loginThroughUi(page, username, password);
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(username);
	});

	it("should disable unlinking Discord when no password is set", async ({ page, ott }) => {
		const username = faker.internet.userName();

		await ott.createSocialUser({ username });
		await ott.forceLogin(username);
		await visitAccount(page);

		await expect(page.locator('[data-cy="account-unlink-discord"]')).toBeVisible();
		await expect(page.locator('[data-cy="account-unlink-discord"]')).toBeDisabled();
		await expect(
			page.getByText("A password is required before you can unlink Discord."),
		).toBeVisible();
		await expectAccount(ott, { username, discordLinked: true, hasPassword: false });
	});

	it("should let a password account unlink Discord", async ({ page, ott }) => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};

		await ott.createUser(userCreds);
		await ott.setDiscordLink({ username: userCreds.username });
		await ott.login({ user: userCreds.username, password: userCreds.password });
		await visitAccount(page);

		await page.locator('[data-cy="account-unlink-discord"]').click();
		await expect(page.getByText("Discord unlinked.")).toBeVisible();
		await expect(page.locator('[data-cy="account-link-discord"]')).toBeVisible();
		await expect(page.locator('[data-cy="account-unlink-discord"]')).toHaveCount(0);
		await page.locator('[data-cy="user-logged-in"]').first().click();
		await expect(page.getByRole("menuitem", { name: "Link Discord" })).toBeVisible();
		await expectAccount(ott, { username: userCreds.username, discordLinked: false });
	});

	it("should reject the wrong current password before allowing a password change", async ({
		page,
		ott,
	}) => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const nextPassword = faker.internet.password(14);

		await ott.createUser(userCreds);
		await ott.login({ user: userCreds.username, password: userCreds.password });
		await visitAccount(page);

		await page
			.locator('[data-cy="account-current-password"]')
			.fill("definitely-wrong-password");
		await page.locator('[data-cy="account-new-password"]').fill(nextPassword);
		await page.locator('[data-cy="account-new-password-confirm"]').fill(nextPassword);
		await page.locator('[data-cy="account-save-password"]').click();
		await expect(page.getByText("Current password is incorrect.")).toBeVisible();
		await expectAccount(ott, {
			email: userCreds.email,
			username: userCreds.username,
			hasPassword: true,
		});

		await page.context().clearCookies();
		await ott.ensureToken();
		await loginThroughUi(page, userCreds.username, userCreds.password);
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(userCreds.username);
	});

	it("should let a local account change its password", async ({ page, ott }) => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const nextPassword = faker.internet.password(14);

		await ott.createUser(userCreds);
		await ott.login({ user: userCreds.username, password: userCreds.password });
		await visitAccount(page);

		await page.locator('[data-cy="account-current-password"]').fill(userCreds.password);
		await page.locator('[data-cy="account-new-password"]').fill(nextPassword);
		await page.locator('[data-cy="account-new-password-confirm"]').fill(nextPassword);
		await page.locator('[data-cy="account-save-password"]').click();

		await page.context().clearCookies();
		await ott.ensureToken();
		await loginThroughUi(page, userCreds.username, userCreds.password);
		await expect(page.locator('[data-cy="user-logged-in"]')).toHaveCount(0);

		await page.locator('[data-cy="login-password"]').fill(nextPassword);
		await page.locator('[data-cy="login-button"]').click();
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(userCreds.username);
	});
});
