import _ from "lodash";
import type { OttApiRequestRoomCreate } from "ott-common/models/rest-api.js";
import { type AuthToken, QueueMode, Visibility } from "ott-common/models/types.js";
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
import tokens from "../../../../server/auth/tokens.js";
import { RoomNotFoundException } from "../../../../server/exceptions.js";
import { conf } from "../../../../server/ott-config.js";
import roommanager from "../../../../server/roommanager.js";
import { main } from "../../../app.js";
import { UnloadReason } from "../../../generated.js";
import { Room as RoomModel, User as UserModel } from "../../../models/index.js";
import type { User } from "../../../models/user.js";
import usermanager from "../../../usermanager.js";

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
				message: () =>
					`expected error to not be RoomNotFoundException, but got ${error.name}`,
				pass,
			};
		} else {
			return {
				message: () => `expected error to be RoomNotFoundException, but got ${error.name}`,
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

describe("Room API", () => {
	let app;
	let owner: User;
	let token: AuthToken;

	beforeAll(async () => {
		app = (await main()).app;

		const auth = await request(app).get("/api/auth/grant");
		token = auth.body.token;

		owner = await usermanager.registerUser({
			email: "owner@localhost",
			username: "owner",
			password: "password1234",
		});
	});

	afterAll(async () => {
		await owner?.destroy();
	});

	describe("GET /room/:name", () => {
		let getSessionInfoSpy: MockInstance;
		let validateSpy: MockInstance;
		beforeAll(async () => {
			getSessionInfoSpy = vi.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: false,
				username: "test",
			});
			validateSpy = vi.spyOn(tokens, "validate").mockResolvedValue(true);
		});

		afterAll(() => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();
		});

		afterEach(async () => {
			try {
				await roommanager.unloadRoom("test1", UnloadReason.Admin);
			} catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
		});

		it.each([Visibility.Public, Visibility.Unlisted])(
			"should get %s room metadata",
			async (visibility: Visibility) => {
				await roommanager.createRoom({
					name: "test1",
					isTemporary: true,
					visibility: visibility,
				});

				let resp = await request(app)
					.get("/api/room/test1")
					.auth(token, { type: "bearer" })
					.set({ Authorization: "Bearer foobar" })
					.expect("Content-Type", /json/)
					.expect(200);

				// TODO: This is currently not type-checked. Ideally, we would be able to type-check the response using a definition from `common`.
				expect(resp.body).toMatchObject({
					name: "test1",
					title: "",
					description: "",
					queueMode: QueueMode.Manual,
					visibility: visibility,
				});
			}
		);

		it("should fail if the room does not exist", async () => {
			let resp = await request(app)
				.get("/api/room/test1")
				.auth(token, { type: "bearer" })
				.expect("Content-Type", /json/)
				.expect(404);
			expect(resp.body.success).toEqual(false);
			expect(resp.body.error).toBeRoomNotFound();
		});
	});

	describe("POST /room/create", () => {
		let getSessionInfoSpy: MockInstance;
		let validateSpy: MockInstance;

		beforeAll(async () => {
			getSessionInfoSpy = vi.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: false,
				username: "test",
			});
			validateSpy = vi.spyOn(tokens, "validate").mockResolvedValue(true);
		});

		afterAll(async () => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();

			await RoomModel.destroy({ where: { name: "testnoowner" } });
			await RoomModel.destroy({ where: { name: "testowner" } });
			await RoomModel.destroy({ where: { name: "testpermdisabled" } });
		});

		afterEach(async () => {
			try {
				await roommanager.unloadAllRooms();
			} catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
		});

		it.each([Visibility.Public, Visibility.Unlisted])(
			"should create %s room",
			async (visibility: Visibility) => {
				let resp = await request(app)
					.post("/api/room/create")
					.auth(token, { type: "bearer" })
					.send({ name: "test1", isTemporary: true, visibility: visibility })
					.expect("Content-Type", /json/)
					.expect(201);
				expect(resp.body.success).toBe(true);
				expect(roommanager.rooms[0]).toMatchObject({
					name: "test1",
					isTemporary: true,
					visibility: visibility,
				});
			}
		);

		it.each([
			[{ isTemporary: true }],
			[{ name: "list", isTemporary: true }],
			[{ name: "create", isTemporary: true }],
			[{ name: "generate", isTemporary: true }],
			[{ name: "abc<", isTemporary: true }],
			[{ name: "abc[", isTemporary: true }],
			[{ name: "abc]", isTemporary: true }],
			[{ name: "abc!", isTemporary: true }],
			[{ name: "abc!", isTemporary: true }],
			[{ name: "ab", isTemporary: true }],
			[
				{
					name: "abababababababababababababababababababababababababababababababababab",
					isTemporary: true,
				},
			],
			[
				{
					name: "foo",
					title: "abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab",
					isTemporary: true,
				},
			],
			[{ name: "test1", isTemporary: true, visibility: "invalid" }],
		])("should fail to create room for validation errors: %s", async body => {
			let resp = await request(app)
				.post("/api/room/create")
				.auth(token, { type: "bearer" })
				.send(body)
				.expect("Content-Type", /json/)
				.expect(400);
			expect(resp.body.success).toEqual(false);
			expect(resp.body.error).toMatchObject({
				name: "ZodValidationError",
			});
		});

		it("should create permanent room without owner", async () => {
			let resp = await request(app)
				.post("/api/room/create")
				.auth(token, { type: "bearer" })
				.send({ name: "testnoowner", isTemporary: false })
				.expect("Content-Type", /json/)
				.expect(201);
			expect(resp.body.success).toEqual(true);
			expect(roommanager.rooms[0]).toMatchObject({
				name: "testnoowner",
				owner: null,
			});
			await roommanager.unloadRoom("testnoowner", UnloadReason.Admin);
			await RoomModel.destroy({ where: { name: "testnoowner" } });
		});

		it("should create permanent room with owner", async () => {
			vi.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: true,
				user_id: owner.id,
			});
			let resp = await request(app)
				.post("/api/room/create")
				.auth(token, { type: "bearer" })
				.send({ name: "testowner" })
				.expect("Content-Type", /json/)
				.expect(201);
			expect(resp.body.success).toEqual(true);
			expect(_.pick(roommanager.rooms[0], "name", "owner.id", "owner.email")).toMatchObject({
				name: "testowner",
				owner: {
					id: owner.id,
					email: owner.email,
				},
			});
			await roommanager.unloadRoom("testowner", UnloadReason.Admin);
			await RoomModel.destroy({ where: { name: "testowner" } });
		});

		const requests: [string, OttApiRequestRoomCreate | undefined][] = [
			["/api/room/create", { name: "testtempdisabled", isTemporary: true }],
			["/api/room/create", { name: "testpermdisabled", isTemporary: false }],
			["/api/room/generate", undefined],
		];

		for (const [path, body] of requests) {
			it(`should fail to create room if feature is disabled: Endpoint ${path} body ${JSON.stringify(
				body
			)}`, async () => {
				conf.set("room.enable_create_temporary", false);
				conf.set("room.enable_create_permanent", false);

				const resp = await request(app)
					.post(path)
					.auth(token, { type: "bearer" })
					.send(body)
					.expect("Content-Type", /json/)
					.expect(403);
				expect(resp.body.success).toEqual(false);
				expect(resp.body.error).toMatchObject({
					name: "FeatureDisabledException",
				});
			});
		}
	});

	describe("PATCH /api/room/:name", () => {
		let getSessionInfoSpy: MockInstance;
		let validateSpy: MockInstance;

		beforeAll(async () => {
			getSessionInfoSpy = vi.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: false,
				username: "test",
			});
			validateSpy = vi.spyOn(tokens, "validate").mockResolvedValue(true);

			await roommanager.createRoom({
				name: "foo",
				isTemporary: true,
			});
		});

		afterAll(async () => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();

			try {
				await roommanager.unloadRoom("foo", UnloadReason.Admin);
			} catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
		});

		it.each([
			[
				{
					title: "abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab",
				},
			],
			[
				{
					autoSkipSegmentCategories: ["invalid", "intro"],
				},
			],
		])("should fail to modify room for validation errors: %s", async body => {
			let resp = await request(app)
				.patch("/api/room/foo")
				.auth(token, { type: "bearer" })
				.send(body)
				.expect("Content-Type", /json/)
				.expect(400);
			expect(resp.body.success).toEqual(false);
			expect(resp.body.error).toMatchObject({
				name: "ZodValidationError",
			});
		});

		it.each([
			[Array(100).fill("sponsor"), ["sponsor"]],
			[
				["intro", "intro", "outro"],
				["intro", "outro"],
			],
			[
				[
					"sponsor",
					"intro",
					"outro",
					"interaction",
					"selfpromo",
					"music_offtopic",
					"preview",
				],
				[
					"sponsor",
					"intro",
					"outro",
					"interaction",
					"selfpromo",
					"music_offtopic",
					"preview",
				],
			],
			[[], []],
		])(
			"should update autoSkipSegmentCategories with only unique valid auto-skip segment categories",
			async (requestAutoSkipSegmentCategories, savedAutoSkipSegmentCategories) => {
				let resp = await request(app)
					.patch("/api/room/foo")
					.auth(token, { type: "bearer" })
					.send({
						autoSkipSegmentCategories: requestAutoSkipSegmentCategories,
					})
					.expect("Content-Type", /json/)
					.expect(200);
				expect(resp.body.success).toEqual(true);
				const roomResult = await roommanager.getRoom("foo");
				expect(_.pick(roomResult.value, "autoSkipSegmentCategories")).toMatchObject({
					autoSkipSegmentCategories: savedAutoSkipSegmentCategories,
				});
			}
		);
	});
});
