import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
	vi,
	type Mock,
} from "vitest";
import request from "supertest";
import { main } from "../../../app.js";
import usermanager from "../../../usermanager.js";
import { conf } from "../../../ott-config.js";
import type { User } from "../../../models/user.js";
import type { AuthToken } from "ott-common/models/types.js";

describe("User API", () => {
	let token;
	let app;
	let forcedUser: User;
	let testUser: User;
	let socialUser: User;

	beforeAll(async () => {
		app = (await main()).app;
	});

	beforeEach(async () => {
		forcedUser = await usermanager.registerUser({
			email: "forced@localhost",
			username: "forced test user",
			password: "test1234",
		});

		testUser = await usermanager.registerUser({
			email: "test@localhost",
			username: "test user",
			password: "test1234",
		});

		socialUser = await usermanager.registerUserSocial({
			username: "social user",
			discordId: 1234567890,
		});

		const resp = await request(app).get("/api/auth/grant").expect(200);
		token = resp.body.token;
	});

	afterEach(async () => {
		await forcedUser?.destroy();
		await testUser?.destroy();
		await socialUser?.destroy();
	});

	describe("GET /user", () => {
		it("should not fail by default", async () => {
			const resp = await request(app)
				.get("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.expect("Content-Type", /json/)
				.expect(200);
			expect(resp.body.username).toBeDefined();
			expect(resp.body.loggedIn).toBe(false);
		});

		it("should have the forced test user logged in", async () => {
			const resp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = resp.header["set-cookie"];

			await request(app)
				.get("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.username).toBeDefined();
					expect(resp.body.loggedIn).toBe(true);
					expect(resp.body).toEqual({
						username: "forced test user",
						loggedIn: true,
						discordLinked: false,
					});
				});
		});
	});

	describe("POST /user", () => {
		let onUserModifiedSpy;

		beforeAll(() => {
			onUserModifiedSpy = vi.fn();
			usermanager.on("userModified", onUserModifiedSpy);
		});

		beforeEach(async () => {
			onUserModifiedSpy.mockClear();
		});

		afterAll(() => {
			onUserModifiedSpy.mockRestore();
			usermanager.off("userModified", onUserModifiedSpy);
		});

		it("should change the unregistered user's name without failing", async () => {
			let resp = await request(app)
				.post("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.send({ username: "new username" })
				.expect("Content-Type", /json/)
				.expect(200);

			expect(resp.body.success).toBe(true);
			expect(onUserModifiedSpy).toBeCalled();

			resp = await request(app)
				.get("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(resp.body.username).toBe("new username");
		});

		it("should change the registered user's name without failing", async () => {
			let cookies;
			await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200)
				.then(resp => {
					cookies = resp.header["set-cookie"];
				});

			await request(app)
				.post("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ username: "new username" })
				.expect("Content-Type", /json/)
				// .expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
					expect(onUserModifiedSpy).toBeCalled();
				});

			const resp = await request(app)
				.get("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(resp.body.username).toBe("new username");
		});

		it("should not change the registered user's name if it's already in use", async () => {
			let cookies;
			await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200)
				.then(resp => {
					cookies = resp.header["set-cookie"];
				});

			await request(app)
				.post("/api/user")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ username: "test user" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toBeDefined();
					expect(resp.body.error.name).toEqual("UsernameTaken");
					expect(onUserModifiedSpy).not.toBeCalled();
				});
		});
	});

	describe("GET /user/account", () => {
		it("should require login", async () => {
			const resp = await request(app)
				.get("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.expect("Content-Type", /json/)
				.expect(401);

			expect(resp.body.success).toBe(false);
		});

		it("should return the logged in account", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			const resp = await request(app)
				.get("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.expect("Content-Type", /json/)
				.expect(200);

			expect(resp.body).toEqual({
				success: true,
				username: "forced test user",
				email: "forced@localhost",
				discordLinked: false,
				hasPassword: true,
			});
		});
	});

	describe("PATCH /user/account", () => {
		it("should require login", async () => {
			const resp = await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.send({ email: "new@localhost" })
				.expect("Content-Type", /json/)
				.expect(401);

			expect(resp.body.success).toBe(false);
		});

		it("should add an email to a password-only account", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await forcedUser.update({ email: null });

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ email: "forced-updated@example.com" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});

			await forcedUser.reload();
			expect(forcedUser.email).toBe("forced-updated@example.com");
		});

		it("should change email for an account that already has one", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ email: "forced-changed@example.com" })
				.expect("Content-Type", /json/)
				.expect(200);

			await forcedUser.reload();
			expect(forcedUser.email).toBe("forced-changed@example.com");
		});

		it("should reject duplicate emails", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await testUser.update({ email: "test@example.com" });

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ email: "test@example.com" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error.name).toBe("AlreadyInUse");
				});
		});

		it("should reject invalid emails", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ email: "not-an-email" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error.name).toBe("ValidationError");
				});
		});

		it("should add a password to a social-only account", async () => {
			await socialUser.update({ email: null, hash: null, salt: null });

			const socialTokenResp = await request(app).get("/api/auth/grant").expect(200);
			const socialToken = socialTokenResp.body.token;

			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.query({ user: "social user" })
				.set("Authorization", `Bearer ${socialToken}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${socialToken}`)
				.set("Cookie", cookies)
				.send({ newPassword: "Password123" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});

			await socialUser.reload();
			expect(socialUser.hash).toBeTruthy();
			expect(socialUser.salt).toBeTruthy();

			await request(app)
				.post("/api/user/login")
				.set("Authorization", `Bearer ${socialToken}`)
				.send({ user: "social user", password: "Password123" })
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should add email and password to a social-only account and allow username login", async () => {
			await socialUser.update({ email: null, hash: null, salt: null });

			const socialTokenResp = await request(app).get("/api/auth/grant").expect(200);
			const socialToken = socialTokenResp.body.token;

			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.query({ user: "social user" })
				.set("Authorization", `Bearer ${socialToken}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await socialUser.update({ username: "social user account" });

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${socialToken}`)
				.set("Cookie", cookies)
				.send({
					email: "social-added@example.com",
					newPassword: "Password123",
				})
				.expect("Content-Type", /json/)
				.expect(200);

			await socialUser.reload();
			expect(socialUser.email).toBe("social-added@example.com");
			expect(socialUser.hash).toBeTruthy();
			expect(socialUser.salt).toBeTruthy();

			await request(app)
				.post("/api/user/login")
				.set("Authorization", `Bearer ${socialToken}`)
				.send({ user: "social user account", password: "Password123" })
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
					expect(resp.body.user).toEqual({
						username: "social user account",
						email: "social-added@example.com",
					});
				});
		});

		it("should require the current password to change an existing password", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ newPassword: "Password123" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error.name).toBe("CurrentPasswordRequired");
				});
		});

		it("should reject password change when the current password is wrong", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ newPassword: "Password123", currentPassword: "wrong-password" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error.name).toBe("InvalidPassword");
				});
		});

		it("should change the password and allow logging in with the new one", async () => {
			const loginResp = await request(app)
				.get("/api/user/test/forceLogin")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			const cookies = loginResp.header["set-cookie"];

			await request(app)
				.patch("/api/user/account")
				.set("Authorization", `Bearer ${token}`)
				.set("Cookie", cookies)
				.send({ newPassword: "Password123", currentPassword: "test1234" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});

			await request(app)
				.post("/api/user/login")
				.set("Authorization", `Bearer ${token}`)
				.send({ user: "forced test user", password: "test1234" })
				.expect(401)
				.then(resp => {
					expect(resp.body.success).toBe(false);
				});

			await request(app)
				.post("/api/user/login")
				.set("Authorization", `Bearer ${token}`)
				.send({ user: "forced test user", password: "Password123" })
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});
	});

	describe("User login and registration", () => {
		describe("POST /user/login", () => {
			let onUserLogInSpy;

			beforeAll(() => {
				onUserLogInSpy = vi.fn();
				usermanager.on("login", onUserLogInSpy);
			});

			beforeEach(async () => {
				onUserLogInSpy.mockClear();
			});

			afterAll(() => {
				onUserLogInSpy.mockRestore();
				usermanager.off("login", onUserLogInSpy);
			});

			it("should log in the test user", async () => {
				await request(app)
					.post("/api/user/login")
					.set("Authorization", `Bearer ${token}`)
					.send({ user: "test@localhost", password: "test1234" })
					.then(resp => {
						expect(resp.body).toEqual({
							success: true,
							user: {
								username: "test user",
								email: "test@localhost",
							},
						});
						expect(onUserLogInSpy).toBeCalled();
					});
			});

			it("should not log in the test user with wrong credentials", async () => {
				await request(app)
					.post("/api/user/login")
					.set("Authorization", `Bearer ${token}`)
					.send({ user: "notreal@localhost", password: "test1234" })
					.then(resp => {
						expect(resp.body.success).toBe(false);
						expect(onUserLogInSpy).not.toBeCalled();
					});
				await request(app)
					.post("/api/user/login")
					.set("Authorization", `Bearer ${token}`)
					.send({ user: "test@localhost", password: "wrong" })
					.then(resp => {
						expect(resp.body.success).toBe(false);
						expect(onUserLogInSpy).not.toBeCalled();
					});
			});

			it("should not log in the social user with no password", async () => {
				await request(app)
					.post("/api/user/login")
					.set("Authorization", `Bearer ${token}`)
					.send({ user: "social@localhost", password: "test1234" })
					.then(resp => {
						expect(resp.body.success).toBe(false);
						expect(onUserLogInSpy).not.toBeCalled();
					});
			});
		});

		describe("POST /user/logout", () => {
			let onUserLogOutSpy;

			beforeAll(() => {
				onUserLogOutSpy = vi.fn();
				usermanager.on("logout", onUserLogOutSpy);
			});

			beforeEach(async () => {
				onUserLogOutSpy.mockClear();
			});

			afterAll(() => {
				onUserLogOutSpy.mockRestore();
				usermanager.off("logout", onUserLogOutSpy);
			});

			it("should log out the test uesr", async () => {
				await request(app)
					.get("/api/user/test/forceLogin")
					.set("Authorization", `Bearer ${token}`)
					.expect(200);

				const resp = await request(app)
					.post("/api/user/logout")
					.set("Authorization", `Bearer ${token}`)
					.expect("Content-Type", /json/)
					.expect(200);

				expect(resp.body.success).toBe(true);
			});

			it("should fail if the user is not logged in", async () => {
				await request(app)
					.post("/api/user/logout")
					.set("Authorization", `Bearer ${token}`)
					.expect("Content-Type", /json/)
					.expect(400)
					.then(resp => {
						expect(resp.body.success).toBe(false);
					});
			});
		});

		describe("POST /user/register", () => {
			let onUserLogInSpy: Mock<[User, AuthToken]>;
			const registeredUsers: User[] = [];

			beforeAll(() => {
				onUserLogInSpy = vi.fn().mockImplementation((user, token) => {
					registeredUsers.push(user);
				});
				usermanager.on("login", onUserLogInSpy);
			});

			beforeEach(async () => {
				onUserLogInSpy.mockClear();
				conf.set("users.enable_registration", true);
			});

			afterEach(async () => {
				for (const user of registeredUsers.splice(0)) {
					await user.destroy();
				}
			});

			afterAll(() => {
				onUserLogInSpy.mockRestore();
				usermanager.off("login", onUserLogInSpy);
			});

			it("should register user", async () => {
				await request(app)
					.post("/api/user/register")
					.set("Authorization", `Bearer ${token}`)
					.send({
						email: "register@localhost",
						username: "registered",
						password: "test1234",
					})
					.expect(201)
					.expect("Content-Type", /json/)
					.then(resp => {
						expect(resp.body).toEqual({
							success: true,
							user: {
								username: "registered",
								email: "register@localhost",
							},
						});
						expect(onUserLogInSpy).toBeCalled();
					});
			});

			it("should register user, but ignore email if it's an empty string ", async () => {
				await request(app)
					.post("/api/user/register")
					.set("Authorization", `Bearer ${token}`)
					.send({ email: "", username: "registered", password: "test1234" })
					.expect(201)
					.expect("Content-Type", /json/)
					.then(resp => {
						expect(resp.body.success).toBe(true);
					});

				await request(app)
					.post("/api/user/register")
					.set("Authorization", `Bearer ${token}`)
					.send({ email: "", username: "registered2", password: "test1234" })
					.expect(201)
					.expect("Content-Type", /json/)
					.then(resp => {
						expect(resp.body.success).toBe(true);
					});
			});

			const denyCases: [string, any, number, any][] = [
				[
					"should not register user if email is already in use",
					{ email: "test@localhost", username: "registered", password: "test1234" },
					400,
					{ name: "AlreadyInUse", fields: ["email"] },
				],
				[
					"should not register user if username is already in use",
					{
						email: "register@localhost",
						username: "test user",
						password: "test1234",
					},
					400,
					{ name: "AlreadyInUse" },
				],
				[
					"should not register user if email is invalid",
					{ email: "bad", username: "bad email user", password: "test1234" },
					400,
					{ name: "ValidationError" },
				],
				[
					"should not register user if username is invalid",
					{ email: "badusername@localhost", username: "", password: "test1234" },
					400,
					{ name: "ValidationError" },
				],
				[
					"should not register user if password is not good enough",
					{ email: "badpassword@localhost", username: "bad password", password: "a" },
					400,
					{ name: "ValidationError" },
				],
			];

			it.each(denyCases)("%s", async (_name, body, respCode, error) => {
				const resp = await request(app)
					.post("/api/user/register")
					.set("Authorization", `Bearer ${token}`)
					.send(body)
					.expect(respCode)
					.expect("Content-Type", /json/);
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toMatchObject(error);
				expect(onUserLogInSpy).not.toBeCalled();
			});

			it("should not register user if registration is disabled", async () => {
				conf.set("users.enable_registration", false);

				await request(app)
					.post("/api/user/register")
					.set("Authorization", `Bearer ${token}`)
					.send({
						email: "register@localhost",
						username: "registered",
						password: "test1234",
					})
					.expect(403)
					.expect("Content-Type", /json/)
					.then(resp => {
						expect(resp.body.success).toBe(false);
						expect(resp.body.error).toMatchObject({
							name: "FeatureDisabledException",
						});
						expect(onUserLogInSpy).not.toBeCalled();
					});
			});
		});
	});
});
