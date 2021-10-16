import { QueueMode, Visibility } from '../../../../common/models/types';
import request from 'supertest';
import tokens from "../../../../server/auth/tokens";
import roommanager from '../../../../server/roommanager';
import { RoomNotFoundException } from '../../../../server/exceptions';
const app = require('../../../../app.js').app;

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
		}
		else {
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
		let pass = this.equals(error, {
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
		}
		else {
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
			jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
				username: "test",
			});
			jest.spyOn(tokens, 'validate').mockResolvedValue(true);
		});

		afterAll(() => {
			tokens.getSessionInfo.mockRestore();
			tokens.validate.mockRestore();
		});

		afterEach(async () => {
			try {
				await roommanager.UnloadRoom("test1");
			}
			catch (e) {
				if (!(e instanceof RoomNotFoundException)) {
					throw e;
				}
			}
		});

		it.each([Visibility.Public, Visibility.Unlisted])("should get %s room metadata", async (visibility: Visibility) => {
			await roommanager.CreateRoom({
				name: "test1",
				isTemporary: true,
				visibility: visibility,
			});

			let resp = await request(app)
				.get("/api/room/test1")
				.set({ "Authorization": "Bearer foobar" })
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
		});

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
});
