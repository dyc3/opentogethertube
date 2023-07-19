import request from "supertest";
import { main } from "../../../app";
import usermanager from "../../../usermanager";
import { User as UserModel } from "../../../models";
import { MockMailer } from "server/mailer";
import { conf } from "../../../ott-config";
import { redisClient } from "../../../redisclient";
import { OttApiRequestAccountRecoveryVerify } from "common/models/rest-api";

describe("Account Recovery", () => {
	let token;
	let app;

	beforeAll(async () => {
		app = (await main()).app;

		await usermanager.registerUser({
			email: "email@localhost",
			username: "email user",
			password: "test1234",
		});

		await usermanager.registerUser({
			email: null,
			username: "no email user",
			password: "test1234",
		});

		let resp = await request(app).get("/api/auth/grant").expect(200);
		token = resp.body.token;

		conf.set("mail.enabled", true);
	});

	beforeEach(async () => {});

	afterEach(() => {
		const mailer: MockMailer = usermanager.mailer as MockMailer;
		mailer.clearSent();
	});

	afterAll(async () => {
		await UserModel.destroy({ where: {} });
	});

	it.each([
		["email", "email@localhost"],
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
				to: "email@localhost",
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
		await redisClient.set("accountrecovery:foo", "email@localhost");

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
		await redisClient.set("accountrecovery:foo", "email@localhost");

		const resp = await request(app)
			.post("/api/user/recover/verify")
			.set("Authorization", `Bearer ${token}`)
			.send(body)
			.expect(400);

		expect(resp.body.success).toBe(false);
	});
});
