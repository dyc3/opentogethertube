import _ from "lodash";
import { QueueMode, Visibility } from "../../../../common/models/types";
import request from "supertest";
import tokens from "../../../../server/auth/tokens";
import roommanager from "../../../../server/roommanager";
import { RoomNotFoundException } from "../../../../server/exceptions";
import { main } from "../../../app";
import { Room as RoomModel, User as UserModel } from "../../../models";
import usermanager from "../../../usermanager";
import { OttApiRequestRoomCreate } from "common/models/rest-api";
import { conf } from "../../../../server/ott-config";

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

	beforeAll(async () => {
		app = (await main()).app;
	});

	describe("GET /room/:name", () => {
		let getSessionInfoSpy: jest.SpyInstance;
		let validateSpy: jest.SpyInstance;
		beforeAll(async () => {
			getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: false,
				username: "test",
			});
			validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);
		});

		afterAll(() => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();
		});

		afterEach(async () => {
			try {
				await roommanager.unloadRoom("test1");
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
				.expect("Content-Type", /json/)
				.expect(404);
			expect(resp.body.success).toEqual(false);
			// @ts-expect-error I can't get typescript to acknowledge the custom matchers.
			expect(resp.body.error).toBeRoomNotFound();
		});
	});

	describe("POST /room/create", () => {
		let getSessionInfoSpy: jest.SpyInstance;
		let validateSpy: jest.SpyInstance;
		beforeAll(async () => {
			getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: false,
				username: "test",
			});
			validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);
		});

		afterAll(() => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();
		});

		afterEach(async () => {
			try {
				await roommanager.unloadAllRooms();
			} catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
			await UserModel.destroy({ where: {} });
		});

		it.each([Visibility.Public, Visibility.Unlisted])(
			"should create %s room",
			async (visibility: Visibility) => {
				let resp = await request(app)
					.post("/api/room/create")
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
			[{ arg: "name", reason: "missing" }, { isTemporary: true }],
			[
				{ arg: "name", reason: "not allowed (reserved)" },
				{ name: "list", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (reserved)" },
				{ name: "create", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (reserved)" },
				{ name: "generate", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (invalid characters)" },
				{ name: "abc<", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (invalid characters)" },
				{ name: "abc[", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (invalid characters)" },
				{ name: "abc]", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (invalid characters)" },
				{ name: "abc!", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (invalid characters)" },
				{ name: "abc!", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (too short, must be at least 3 characters)" },
				{ name: "ab", isTemporary: true },
			],
			[
				{ arg: "name", reason: "not allowed (too long, must be at most 32 characters)" },
				{
					name: "abababababababababababababababababababababababababababababababababab",
					isTemporary: true,
				},
			],
			[
				{ arg: "title", reason: "not allowed (too long, must be at most 255 characters)" },
				{
					name: "foo",
					title: "abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab",
					isTemporary: true,
				},
			],
			[
				{ arg: "visibility", reason: "must be one of public,unlisted,private" },
				{ name: "test1", isTemporary: true, visibility: "invalid" },
			],
		])("should fail to create room for validation errors: %s", async (error, body) => {
			let resp = await request(app)
				.post("/api/room/create")
				.send(body)
				.expect("Content-Type", /json/)
				.expect(400);
			expect(resp.body.success).toEqual(false);
			expect(resp.body.error).toMatchObject({
				name: "BadApiArgumentException",
				...error,
			});
		});

		it("should create permanent room without owner", async () => {
			let resp = await request(app)
				.post("/api/room/create")
				.send({ name: "testnoowner", isTemporary: false })
				.expect("Content-Type", /json/)
				.expect(201);
			expect(resp.body.success).toEqual(true);
			expect(roommanager.rooms[0]).toMatchObject({
				name: "testnoowner",
				owner: null,
			});
			await roommanager.unloadRoom("testnoowner");
			await RoomModel.destroy({ where: { name: "testnoowner" } });
		});

		it("should create permanent room with owner", async () => {
			const user = await usermanager.registerUser({
				email: "forced@localhost",
				username: "owner",
				password: "password1234",
			});
			jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: true,
				user_id: user.id,
			});
			let resp = await request(app)
				.post("/api/room/create")
				.send({ name: "testowner" })
				.expect("Content-Type", /json/)
				.expect(201);
			expect(resp.body.success).toEqual(true);
			expect(_.pick(roommanager.rooms[0], "name", "owner.id", "owner.email")).toMatchObject({
				name: "testowner",
				owner: {
					id: user.id,
					email: user.email,
				},
			});
			await roommanager.unloadRoom("testowner");
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
		let getSessionInfoSpy: jest.SpyInstance;
		let validateSpy: jest.SpyInstance;

		beforeAll(async () => {
			getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: false,
				username: "test",
			});
			validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);

			await roommanager.createRoom({
				name: "foo",
				isTemporary: true,
			});
		});

		afterAll(async () => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();

			try {
				await roommanager.unloadRoom("foo");
			} catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
		});

		it.each([
			[
				{ arg: "title", reason: "not allowed (too long, must be at most 255 characters)" },
				{
					title: "abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab",
					isTemporary: true,
				},
			],
		])("should fail to modify room for validation errors: %s", async (error, body) => {
			let resp = await request(app)
				.patch("/api/room/foo")
				.set({ Authorization: "Bearer foobar" })
				.send(body)
				.expect("Content-Type", /json/)
				.expect(400);
			expect(resp.body.success).toEqual(false);
			expect(resp.body.error).toMatchObject({
				name: "BadApiArgumentException",
				...error,
			});
		});
	});

	describe("PATCH /api/room/:name validate autoSkipSegmentCategories", () => {
		let getSessionInfoSpy: jest.SpyInstance;
		let validateSpy: jest.SpyInstance;
		const roomName = "testUpdateAutoSkipSegmentCategories";
		const oldEnableCreatePermanent = conf.get("room.enable_create_permanent");
		const userEmail = "forced2@localhost";

		beforeAll(async () => {
			const user = await usermanager.registerUser({
				email: userEmail,
				username: "owner2",
				password: "password1234",
			});
			getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: true,
				user_id: user.id,
			});
			validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);
			conf.set("room.enable_create_permanent", true);
			await roommanager.createRoom({
				name: roomName,
				isTemporary: false,
				owner: user,
			});
		});

		afterAll(async () => {
			getSessionInfoSpy.mockRestore();
			validateSpy.mockRestore();
			try {
				await roommanager.unloadRoom(roomName);
			} catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
			await UserModel.destroy({ where: { email: userEmail } });
			conf.set("room.enable_create_permanent", oldEnableCreatePermanent);
		});

		it.each([
			[Array(100).fill("sponsor"), ["sponsor"]],
			[
				["invalidCategory1", "invalidCategory2", "intro", "intro", "outro"],
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
			"should update autoSkipSegmentCategories with only unique valid auto-skip segment cateogories",
			async (requestAutoSkipSegmentCategories, savedAutoSkipSegmentCategories) => {
				let resp = await request(app)
					.patch(`/api/room/${roomName}`)
					.set({ Authorization: "Bearer foobar" })
					.send({
						autoSkipSegmentCategories: requestAutoSkipSegmentCategories,
					})
					.expect("Content-Type", /json/)
					.expect(200);
				expect(resp.body.success).toEqual(true);
				const roomResult = await roommanager.getRoom(roomName);
				expect(roomResult.ok).toBeTruthy();
				expect(_.pick(roomResult.value, "autoSkipSegmentCategories")).toMatchObject({
					autoSkipSegmentCategories: savedAutoSkipSegmentCategories,
				});
			}
		);
	});
});
