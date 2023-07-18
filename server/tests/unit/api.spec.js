import request from "supertest";
import { main } from "../../app";
import InfoExtract from "../../infoextractor";
import { ANNOUNCEMENT_CHANNEL } from "../../../common/constants";
import { redisClient } from "../../redisclient";
import tokens from "../../auth/tokens";
import { setApiKey } from "../../admin";

const TEST_API_KEY = "TESTAPIKEY";

expect.extend({
	toBeRoomNotFound(error) {
		if (typeof error === "string") {
			return {
				message: () => `expected error to not be a string`,
				pass: false,
			};
		}
		let pass = this.equals(error, {
			name: "RoomNotFoundException",
			message: "Room not found",
		});
		if (pass) {
			return {
				message: () => `expected error to not be RoomNotFoundException`,
				pass,
			};
		} else {
			return {
				message: () => `expected error to be RoomNotFoundException`,
				pass,
			};
		}
	},

	toBeUnknownError(error) {
		if (typeof error === "string") {
			return {
				message: () => `expected error to not be a string`,
				pass: false,
			};
		}
		let pass =
			this.equals(error, {
				name: "Unknown",
				message: "Failed to get room",
			}) ||
			this.equals(error, {
				name: "Unknown",
				message: "Failed to get video",
			});
		if (pass) {
			return {
				message: () => `expected error to not be Unknown`,
				pass,
			};
		} else {
			return {
				message: () => `expected error to be Unknown`,
				pass,
			};
		}
	},
});

describe("Data API", () => {
	let app;
	beforeAll(async () => {
		jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			username: "test",
		});
		jest.spyOn(tokens, "validate").mockResolvedValue(true);
		app = (await main()).app;
	});

	afterAll(() => {
		tokens.getSessionInfo.mockRestore();
		tokens.validate.mockRestore();
	});

	it("GET /data/previewAdd", async () => {
		let resolveQuerySpy = jest
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockReturnValue(Promise.resolve([]));

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(200)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body.success).toBe(true);
				expect(resp.body.result).toHaveLength(0);
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = jest
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockImplementation(
				() =>
					new Promise((resolve, reject) =>
						reject({ name: "UnsupportedServiceException", message: "error message" })
					)
			);

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(400)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = jest.spyOn(InfoExtract, "resolveVideoQuery").mockImplementation(
			() =>
				new Promise((resolve, reject) =>
					reject({
						name: "InvalidAddPreviewInputException",
						message: "error message",
					})
				)
		);

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(400)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = jest
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockImplementation(
				() =>
					new Promise((resolve, reject) =>
						reject({ name: "OutOfQuotaException", message: "error message" })
					)
			);

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(400)
			.expect("Content-Type", /json/)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
	});
});

describe("Announcements API", () => {
	let app;
	let publishSpy;

	beforeAll(async () => {
		setApiKey(TEST_API_KEY);
		jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			username: "test",
		});
		jest.spyOn(tokens, "validate").mockResolvedValue(true);

		app = (await main()).app;
	});

	beforeEach(() => {
		publishSpy = jest.spyOn(redisClient, "publish").mockImplementation(() => {});
	});

	afterEach(() => {
		publishSpy.mockRestore();
	});

	afterAll(() => {
		tokens.getSessionInfo.mockRestore();
		tokens.validate.mockRestore();
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
