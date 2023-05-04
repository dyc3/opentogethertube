import _ from "lodash";
import { QueueMode, Visibility } from "../../../../common/models/types";
import request from "supertest";
import tokens from "../../../../server/auth/tokens";
import roommanager from "../../../../server/roommanager";
import { RoomNotFoundException } from "../../../../server/exceptions";
const { app } = require("../../../app");
const { Room, User } = require("../../../models");

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
	describe("GET /room/:name", () => {
		beforeAll(async () => {
			jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				username: "test",
			});
			jest.spyOn(tokens, "validate").mockResolvedValue(true);
		});

		afterAll(() => {
			tokens.getSessionInfo.mockRestore();
			tokens.validate.mockRestore();
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
		beforeAll(async () => {
			jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				username: "test",
			});
			jest.spyOn(tokens, "validate").mockResolvedValue(true);
		});

		afterAll(() => {
			tokens.getSessionInfo.mockRestore();
			tokens.validate.mockRestore();
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
					.send({ name: "test1", isTemporary: true, visibility: visibility })
					.expect("Content-Type", /json/)
					.expect(200);
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
				.expect(200);
			expect(resp.body.success).toEqual(true);
			expect(roommanager.rooms[0]).toMatchObject({
				name: "testnoowner",
				owner: null,
			});
			await roommanager.unloadRoom("testnoowner");
			await Room.destroy({ where: { name: "testnoowner" } });
		});

		it("should create permanent room with owner", async () => {
			let user = await User.findOne({ where: { email: "forced@localhost" } });
			jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
				isLoggedIn: true,
				user_id: user.id,
			});
			let resp = await request(app)
				.post("/api/room/create")
				.send({ name: "testowner" })
				.expect("Content-Type", /json/)
				.expect(200);
			expect(resp.body.success).toEqual(true);
			expect(_.pick(roommanager.rooms[0], "name", "owner.id", "owner.email")).toMatchObject({
				name: "testowner",
				owner: {
					id: user.id,
					email: user.email,
				},
			});
			await roommanager.unloadRoom("testowner");
			await Room.destroy({ where: { name: "testowner" } });
		});
	});
});
