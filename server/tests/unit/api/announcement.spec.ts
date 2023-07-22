import request from "supertest";
import { main } from "../../../app";
import { setApiKey } from "../../../admin";
import { ANNOUNCEMENT_CHANNEL } from "../../../../common/constants";
import { redisClient } from "../../../redisclient";
import tokens from "../../../auth/tokens";

const TEST_API_KEY = "TESTAPIKEY";

describe("Announcements API", () => {
	let app;
	let publishSpy;
	let getSessionInfoSpy;
	let validateSpy;

	beforeAll(async () => {
		setApiKey(TEST_API_KEY);
		getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			isLoggedIn: false,
			username: "test",
		});
		validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);

		app = (await main()).app;
	});

	beforeEach(() => {
		publishSpy = jest.spyOn(redisClient, "publish").mockResolvedValue(1);
	});

	afterEach(() => {
		publishSpy.mockRestore();
	});

	afterAll(() => {
		getSessionInfoSpy.mockRestore();
		validateSpy.mockRestore();
	});

	it("should send an announcement", async () => {
		await request(app)
			.post("/api/announce")
			.set({ Authorization: "Bearer foobar" })
			.set("apikey", TEST_API_KEY)
			.send({ text: "test announcement" })
			.expect(200)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body).toEqual({
					success: true,
				});
			});
		expect(publishSpy).toHaveBeenCalledWith(
			ANNOUNCEMENT_CHANNEL,
			'{"action":"announcement","text":"test announcement"}'
		);
	});

	it("should not send announcement if the api key does not match", async () => {
		await request(app)
			.post("/api/announce")
			.set({ Authorization: "Bearer foobar" })
			.send({ text: "test announcement" })
			.expect(400)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: {
						name: "MissingApiKey",
						message: "apikey was not supplied",
					},
				});
			});
		expect(publishSpy).not.toHaveBeenCalled();
		publishSpy.mockReset();

		await request(app)
			.post("/api/announce")
			.set({ Authorization: "Bearer foobar" })
			.set("apikey", "wrong key")
			.send({ text: "test announcement" })
			.expect(400)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: {
						name: "Error",
						message: "apikey is invalid",
					},
				});
			});
		expect(publishSpy).not.toHaveBeenCalled();
	});

	it("should not send an announcement if no text is provided", async () => {
		await request(app)
			.post("/api/announce")
			.set({ Authorization: "Bearer foobar" })
			.set("apikey", TEST_API_KEY)
			.expect(400)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body).toMatchObject({
					success: false,
					error: {
						name: "BadApiArgumentException",
						arg: "text",
						reason: "missing",
					},
				});
			});
		expect(publishSpy).not.toHaveBeenCalled();
	});

	it("should fail if an unknown error occurrs", async () => {
		publishSpy = publishSpy.mockImplementation(() => {
			throw new Error("fake error");
		});

		await request(app)
			.post("/api/announce")
			.set({ Authorization: "Bearer foobar" })
			.set("apikey", TEST_API_KEY)
			.send({ text: "test announcement" })
			.expect(500)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: {
						name: "Unknown",
						message: "Unknown, check logs",
					},
				});
			});
		expect(publishSpy).toHaveBeenCalledWith(
			ANNOUNCEMENT_CHANNEL,
			'{"action":"announcement","text":"test announcement"}'
		);
	});
});
