import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
	vi,
	MockInstance,
} from "vitest";
import request from "supertest";
import { main } from "../../../app";
import InfoExtract, { AddPreview } from "../../../infoextractor";
import tokens from "../../../auth/tokens";

describe("Data API", () => {
	let app;
	let getSessionInfoSpy;
	let validateSpy;

	beforeAll(async () => {
		getSessionInfoSpy = vi.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			isLoggedIn: false,
			username: "test",
		});
		validateSpy = vi.spyOn(tokens, "validate").mockResolvedValue(true);
		app = (await main()).app;
	});

	afterAll(() => {
		getSessionInfoSpy.mockRestore();
		validateSpy.mockRestore();
	});

	it("GET /data/previewAdd", async () => {
		let resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockResolvedValue(new AddPreview([], 0));

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
		resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockRejectedValue({ name: "UnsupportedServiceException", message: "error message" });

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
		resolveQuerySpy = vi.spyOn(InfoExtract, "resolveVideoQuery").mockImplementation(
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
		resolveQuerySpy = vi
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
