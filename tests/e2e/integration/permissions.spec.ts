import faker from "faker";
import { v4 as uuid } from "uuid";
import { describe, expect, it } from "../support/fixtures";

describe("promotion and demotion", () => {
	const roles = [
		{ name: "admin", display: "Administrator" },
		{ name: "mod", display: "Moderator" },
		{ name: "trusted", display: "Trusted User" },
	];

	for (const role of roles) {
		it(`should promote and demote the given user from ${role.display}`, async ({
			context,
			page,
			ott,
		}) => {
			await context.clearCookies();
			await ott.ensureToken();
			await ott.resetRateLimit();
			await ott.request({ method: "POST", url: "/api/dev/reset-rate-limit/user" });

			const userCreds = {
				email: faker.internet.email(),
				username: faker.internet.userName(faker.name.firstName(), faker.name.lastName()),
				password: faker.internet.password(12),
			};
			await ott.createUser(userCreds);
			await ott.login(userCreds);

			const roomName = uuid().substring(0, 20);
			await ott.request({
				method: "POST",
				url: "/api/room/create",
				body: { name: roomName, isTemporary: false },
			});
			await ott.request({
				method: "POST",
				url: `/api/dev/room/${roomName}/add-fake-user`,
				body: { register: true },
			});
			await page.goto(`/room/${roomName}`);

			await page.locator(".user-actions").click();
			await page.getByText(`Promote to ${role.display}`).click();
			await expect(page.locator(`.role-${role.name}`)).toBeVisible();
			await page.locator(`.role-${role.name}`).locator("button").click();
			await page.getByText("Demote to Registered User").click();
			await expect(page.locator(".role-registered")).toBeVisible();
		});
	}
});
