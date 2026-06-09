import faker from "faker";
import { beforeEach, describe, expect, it } from "../support/fixtures";

describe("User login/registration", () => {
	beforeEach(async ({ context, page, ott }) => {
		await context.clearCookies();
		await ott.ensureToken();
		await ott.resetRateLimit();
		await ott.request({ method: "POST", url: "/api/dev/reset-rate-limit/user" });
		await page.goto("/");
	});

	async function openRegister(page) {
		await page.locator('[data-cy="user-logged-out"]').click();
		await page.getByRole("tab", { name: "Register" }).click();
	}

	async function fillRegisterField(page, label: string, value: string) {
		const selectors: Record<string, string> = {
			Email: "#reg-email",
			Username: "#reg-username",
			Password: "#reg-password",
			"Retype Password": "#reg-password2",
		};
		await page.locator(selectors[label]).fill(value);
	}

	it("should register a new user", async ({ page }) => {
		await openRegister(page);
		const username = faker.internet.userName();
		const password = faker.internet.password(10);
		await fillRegisterField(page, "Email", faker.internet.email());
		await fillRegisterField(page, "Username", username);
		await fillRegisterField(page, "Password", password);
		await fillRegisterField(page, "Retype Password", password);
		await page.locator('[data-cy="register-button"]').click();
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(username);
	});

	it("should register a new user without an email", async ({ page }) => {
		await openRegister(page);
		const username = faker.internet.userName();
		const password = faker.internet.password(10);
		await fillRegisterField(page, "Username", username);
		await fillRegisterField(page, "Password", password);
		await fillRegisterField(page, "Retype Password", password);
		await page.locator('[data-cy="register-button"]').click();
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(username);
	});

	for (const loginField of ["email", "username"] as const) {
		it(`should log in an existing user using ${loginField}/password`, async ({ page, ott }) => {
			const userCreds = {
				email: faker.internet.email(),
				username: faker.internet.userName(),
				password: faker.internet.password(12),
			};
			await ott.createUser(userCreds);
			await ott.request({ method: "POST", url: "/api/user/logout" });
			await page.context().clearCookies();
			await ott.ensureToken();

			await page.locator('[data-cy="user-logged-out"]').click();
			await page.locator('[data-cy="login-user"]').fill(userCreds[loginField]);
			await page.locator('[data-cy="login-password"]').fill(userCreds.password);
			await page.locator('[data-cy="login-button"]').click();
			await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(
				userCreds.username,
			);
		});
	}

	it("should keep the user logged in when the page is refreshed", async ({ page, ott }) => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		await ott.createUser(userCreds);
		await ott.request({ method: "POST", url: "/api/user/logout" });
		await page.context().clearCookies();
		await ott.ensureToken();

		await page.locator('[data-cy="user-logged-out"]').click();
		await page.locator('[data-cy="login-user"]').fill(userCreds.email);
		await page.locator('[data-cy="login-password"]').fill(userCreds.password);
		await page.locator('[data-cy="login-button"]').click();
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(userCreds.username);

		await page.goto("/");
		await expect(page.locator('[data-cy="user-logged-in"]')).toContainText(userCreds.username);
	});
});
