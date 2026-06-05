import { expect, test as base } from "@playwright/test";
import type { APIResponse, Locator, Page } from "@playwright/test";

type RequestOptions = {
	method?: string;
	url: string;
	headers?: Record<string, string>;
	body?: unknown;
};

type OttFixtures = {
	ott: {
		apiKey: string;
		ensureToken(): Promise<string>;
		request(options: RequestOptions): Promise<APIResponse>;
		resetRateLimit(): Promise<APIResponse>;
		forceDisconnect(roomName: string): Promise<APIResponse>;
		createUser(userCreds: unknown): Promise<APIResponse>;
		login(userCreds: unknown): Promise<APIResponse>;
		createSocialUser(user: unknown): Promise<APIResponse>;
		forceLogin(username: string): Promise<APIResponse>;
		setDiscordLink(user: unknown): Promise<APIResponse>;
		sliderMove(locator: Locator, percent: number): Promise<void>;
		closeToasts(): Promise<void>;
	};
};

async function getToken(page: Page) {
	return page.evaluate(() => window.localStorage.token as string | undefined);
}

async function expectOttResponse(response: APIResponse) {
	expect(response.ok()).toBe(true);
	const body = await response.json();
	expect(body.success).toBe(true);
	return body;
}

export const test = base.extend<OttFixtures>({
	ott: async ({ page, request }, use) => {
		const apiKey = "TESTAPIKEY-abcdefghijklmnopqrstuvwxyz";

		const ott = {
			apiKey,
			async ensureToken() {
				const response = await request.get("/api/auth/grant");
				expect(response.ok()).toBe(true);
				const body = await response.json();
				await page.goto("/");
				await page.evaluate(token => {
					window.localStorage.clear();
					window.localStorage.setItem("token", token);
				}, body.token);
				return body.token as string;
			},
			async request(options: RequestOptions) {
				const token = await getToken(page);
				const response = await request.fetch(options.url, {
					method: options.method ?? "GET",
					headers: {
						...options.headers,
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
					data: options.body,
				});
				await expectOttResponse(response);
				return response;
			},
			resetRateLimit() {
				return this.request({ method: "POST", url: "/api/dev/reset-rate-limit" });
			},
			forceDisconnect(roomName: string) {
				return this.request({
					method: "POST",
					url: `/api/dev/room/${roomName}/force-disconnect`,
				});
			},
			createUser(userCreds: unknown) {
				return this.request({ method: "POST", url: "/api/user/register", body: userCreds });
			},
			login(userCreds: unknown) {
				return this.request({ method: "POST", url: "/api/user/login", body: userCreds });
			},
			createSocialUser(user: unknown) {
				return this.request({
					method: "POST",
					url: "/api/dev/user/create-social",
					body: user,
				});
			},
			forceLogin(username: string) {
				return this.request({
					method: "POST",
					url: "/api/dev/user/force-login",
					body: { username },
				});
			},
			setDiscordLink(user: unknown) {
				return this.request({
					method: "POST",
					url: "/api/dev/user/set-discord-link",
					body: user,
				});
			},
			async sliderMove(locator: Locator, percent: number) {
				const box = await locator.boundingBox();
				expect(box).not.toBeNull();
				await locator.click({ position: { x: box!.width * percent, y: box!.height / 2 } });
			},
			async closeToasts() {
				await page.locator('[data-cy="toast-close-all"]').click();
			},
		};

		await use(ott);
	},
});

export const it = test;
export const describe = test.describe;
export const beforeEach = test.beforeEach;
export const afterEach = test.afterEach;
export { expect } from "@playwright/test";
