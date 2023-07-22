import request from "supertest";
import { main } from "../../../app";
import InfoExtract from "../../../infoextractor";
import tokens from "../../../auth/tokens";

describe("Data API", () => {
	let app;
	let getSessionInfoSpy;
	let validateSpy;

	beforeAll(async () => {
		getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			isLoggedIn: false,
			username: "test",
		});
		validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);
		app = (await main()).app;
	});

	afterAll(() => {
		getSessionInfoSpy.mockRestore();
		validateSpy.mockRestore();
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
