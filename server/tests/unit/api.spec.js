import request from "supertest";
import { main } from "../../app";
import InfoExtract from "../../infoextractor";
import tokens from "../../auth/tokens";

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
