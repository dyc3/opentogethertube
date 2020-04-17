const request = require('supertest');
const roommanager = require('../../../roommanager.js');
jest.spyOn(roommanager, "getAllLoadedRooms").mockReturnValue(Promise.resolve([]));
const app = require('../../../app.js').app;
const usermanager = require('../../../usermanager.js');
const { User } = require("../../../models");

const TEST_API_KEY = "TESTAPIKEY";

describe("User API", () => {
	describe("GET /user", () => {
		it("should not fail be default", done => {
			request(app)
				.get("/api/user")
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.username).toBeDefined();
					expect(resp.body.loggedIn).toBeFalsy();
					done();
				});
		});

		it("should have the forced test user logged in", async done => {
			let cookies;
			await request(app)
				.get("/api/user/test/forceLogin")
				.expect(200)
				.then(resp => {
					cookies = resp.header["set-cookie"];
				});

			console.log(cookies);

			await request(app)
				.get("/api/user")
				.set("Cookie", cookies)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.username).toBeDefined();
					expect(resp.body.loggedIn).toBeTruthy();
					expect(resp.body).toEqual({
						username: "forced test user",
						loggedIn: true,
					});
					done();
				});
		});
	});

	describe("POST /user", () => {
		let onUserModifiedSpy;

		beforeAll(() => {
			onUserModifiedSpy = jest.spyOn(usermanager, "onUserModified").mockImplementation(() => {});
		});

		beforeEach(async () => {
			onUserModifiedSpy.mockClear();
			await User.update({ username: "forced test user" }, { where: { email: "forced@localhost" } });
		});

		afterAll(() => {
			onUserModifiedSpy.mockRestore();
		});

		it("should change the unregistered user's name without failing", done => {
			request(app)
				.post("/api/user")
				.send({ username: "new username" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBeTruthy();
					expect(onUserModifiedSpy).toBeCalled();
					done();
				});
		});

		it("should change the registered user's name without failing", async done => {
			await request(app)
				.get("/api/user/test/forceLogin")
				.expect(200);

			await request(app)
				.post("/api/user")
				.send({ username: "new username" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBeTruthy();
					expect(onUserModifiedSpy).toBeCalled();
					done();
				});
		});
	});
});
