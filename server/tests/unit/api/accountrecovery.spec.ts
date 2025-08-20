import type { OttApiRequestAccountRecoveryVerify } from "ott-common/models/rest-api.js";
import type { MockMailer } from "server/mailer.js";
import request from "supertest";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	MockInstance,
	vi,
} from "vitest";
import { main } from "../../../app.js";
import type { User } from "../../../models/user.js";
import { conf } from "../../../ott-config.js";
import { redisClient } from "../../../redisclient.js";
import usermanager from "../../../usermanager.js";

describe("Account Recovery", () => {
	let token;
	let app;
	let emailUser: User;
	let noEmailUser: User;

	beforeAll(async () => {
		app = (await main()).app;

		emailUser = await usermanager.registerUser({
			email: "email@localhost.com",
			username: "email user",
			password: "test1234",
		});

		noEmailUser = await usermanager.registerUser({
			email: null,
			username: "no email user",
			password: "test1234",
		});

		let resp = await request(app).get("/api/auth/grant").expect(200);
		token = resp.body.token;

		conf.set("mail.enabled", true);
	});

	// biome-ignore lint/suspicious/noEmptyBlockStatements: biome migration
	beforeEach(async () => {});

	afterEach(() => {
		const mailer: MockMailer = usermanager.mailer as MockMailer;
		mailer.clearSent();
	});

	afterAll(async () => {
		await emailUser.destroy();
		await noEmailUser.destroy();
		conf.set("mail.enabled", false);
	});

	it.each([
		["email", "email@localhost.com"],
		["username", "email user"],
	])(
		"should send a recovery email when using %s field in request",
		async (field: string, value: string) => {
			const resp = await request(app)
				.post("/api/user/recover/start")
				.set("Authorization", `Bearer ${token}`)
				.send({ [field]: value });

			expect(resp.body).toMatchObject({
				success: true,
			});

			const mailer: MockMailer = usermanager.mailer as MockMailer;
			expect(mailer.sentEmails).toHaveLength(1);
			expect(mailer.sentEmails[0]).toMatchObject({
				to: "email@localhost.com",
			});
		}
	);

	it("should not send a recovery email when there is no email", async () => {
		const resp = await request(app)
			.post("/api/user/recover/start")
			.set("Authorization", `Bearer ${token}`)
			.send({ username: "no email user" })
			.expect(400);

		expect(resp.body.success).toBe(false);
		expect(resp.body.error).toMatchObject({
			name: "NoEmail",
		});

		const mailer: MockMailer = usermanager.mailer as MockMailer;
		expect(mailer.sentEmails).toHaveLength(0);
	});

	it.each([{}, { email: "doesnot@exi.st" }])(
		"should not send a recovery email when the request is bad: %s",
		async (body: any) => {
			const resp = await request(app)
				.post("/api/user/recover/start")
				.set("Authorization", `Bearer ${token}`)
				.send(body)
				.expect(400);

			expect(resp.body.success).toBe(false);

			const mailer: MockMailer = usermanager.mailer as MockMailer;
			expect(mailer.sentEmails).toHaveLength(0);
		}
	);

	it("should change the password when the verify key is valid", async () => {
		await redisClient.set("accountrecovery:foo", "email@localhost.com");

		const body: OttApiRequestAccountRecoveryVerify = {
			verifyKey: "foo",
			newPassword: "test5678",
		};

		const resp = await request(app)
			.post("/api/user/recover/verify")
			.set("Authorization", `Bearer ${token}`)
			.send(body);

		expect(resp.body).toMatchObject({
			success: true,
		});
	});

	it.each([
		{},
		{ verifyKey: "foo" },
		{ newPassword: "test5678" },
		{ verifyKey: "foo", newPassword: "asdf" },
		{ verifyKey: "bar", newPassword: "asdf1234" },
	])("should not change the password when the request is bad: %s", async (body: any) => {
		await redisClient.set("accountrecovery:foo", "email@localhost.com");

		const resp = await request(app)
			.post("/api/user/recover/verify")
			.set("Authorization", `Bearer ${token}`)
			.send(body)
			.expect(400);

		expect(resp.body.success).toBe(false);
	});
});
