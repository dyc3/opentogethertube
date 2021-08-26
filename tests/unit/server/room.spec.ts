import dayjs from "dayjs";
import tokens from "../../../server/auth/tokens";
import { RoomRequestType } from "../../../common/models/messages";
import { QueueMode, Role } from "../../../common/models/types";
import { Room, RoomUser } from "../../../server/room";

describe("Room", () => {
	beforeAll(() => {
		jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
			username: "test",
			isLoggedIn: false,
		});
		jest.spyOn(tokens, 'validate').mockResolvedValue(true);
	});

	afterAll(() => {
		tokens.getSessionInfo.mockRestore();
		tokens.validate.mockRestore();
	});

	it("should control playback with play/pause", async () => {
		const room = new Room({ name: "test" });
		await room.play();
		expect(room.isPlaying).toEqual(true);
		await room.play();
		await room.pause();
		expect(room.isPlaying).toEqual(false);
		await room.pause();
	});

	describe("Room Requests", () => {
		let room: Room;
		let user: RoomUser;

		beforeEach(() => {
			user = new RoomUser("user");
			user.token = "asdf1234";
			room = new Room({ name: "test" });
			room.realusers = [user];
		});

		describe("PlaybackRequest", () => {
			it("should play and pause", async () => {
				await room.processRequest({
					type: RoomRequestType.PlaybackRequest,
					client: user.id,
					token: user.token,
					state: true,
				});
				expect(room.isPlaying).toEqual(true);
				await room.processRequest({
					type: RoomRequestType.PlaybackRequest,
					client: user.id,
					token: user.token,
					state: false,
				});
				expect(room.isPlaying).toEqual(false);
			});

			it("should advance playback position", async () => {
				room.isPlaying = true;
				room._playbackStart = dayjs().subtract(5, "second");
				await room.processRequest({
					type: RoomRequestType.PlaybackRequest,
					client: user.id,
					token: user.token,
					state: false,
				});
				expect(room.isPlaying).toEqual(false);
				expect(room.playbackPosition).toBeCloseTo(5, 1);
				expect(room.playbackPosition).toBeGreaterThanOrEqual(5);
			});
		});

		describe("SkipRequest", () => {
			beforeEach(() => {
				room.currentSource = {
					service: "test",
					id: "video",
				};
			});

			it("skip with empty queue", async () => {
				await room.processRequest({
					type: RoomRequestType.SkipRequest,
					client: user.id,
					token: user.token,
				});
				expect(room.currentSource).toBeNull();
			});

			it("skip with non-empty queue", async () => {
				room.queue = [
					{
						service: "test",
						id: "video2",
					},
				];
				await room.processRequest({
					type: RoomRequestType.SkipRequest,
					client: user.id,
					token: user.token,
				});
				expect(room.currentSource).toEqual({
					service: "test",
					id: "video2",
				});
			});
		});

		describe("SeekRequest", () => {
			it("should seek", async () => {
				room.playbackPosition = 10;
				await room.processRequest({
					type: RoomRequestType.SeekRequest,
					client: user.id,
					token: user.token,
					value: 15,
				});
				expect(room.playbackPosition).toEqual(15);
			});

			it.each([undefined, null])("should not seek if value is %s", async (v) => {
				room.playbackPosition = 10;
				await room.processRequest({
					type: RoomRequestType.SeekRequest,
					client: user.id,
					token: user.token,
					value: v,
				});
				expect(room.playbackPosition).toEqual(10);
			});
		});
	});

	describe("auto dequeuing next video", () => {
		let room: Room;

		beforeEach(() => {
			room = new Room({ name: "test" });
			room.currentSource = {
				service: "test",
				id: "video",
			};
			room.queue = [
				{
					service: "test",
					id: "video2",
				},
			];
		});

		it.each([QueueMode.Manual, QueueMode.Vote])("should consume the current item when mode is %s", (mode) => {
			room.queueMode = mode;
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video2",
			});
			expect(room.queue).toHaveLength(0);
		});

		it.each([QueueMode.Loop])("should requeue the current item when mode is %s", (mode) => {
			room.queueMode = mode;
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video2",
			});
			expect(room.queue).toHaveLength(1);
			expect(room.queue[0]).toEqual({
				service: "test",
				id: "video",
			});
		});

		it.each([QueueMode.Dj])("should restart the current item when mode is %s", (mode) => {
			room.queueMode = mode;
			room.playbackPosition = 10;
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video",
			});
			expect(room.playbackPosition).toEqual(0);
			expect(room.queue).toHaveLength(1);
			expect(room.queue[0]).toEqual({
				service: "test",
				id: "video2",
			});
		});

		it.each([QueueMode.Loop])("should requeue the current item when mode is %s, with empty queue", (mode) => {
			room.queueMode = mode;
			room.queue = [];
			expect(room.queue).toHaveLength(0);
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video",
			});
			expect(room.queue).toHaveLength(0);
		});
	});

	it("should be able to get role in unowned room", async () => {
		jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
			username: "test",
			isLoggedIn: false,
		});

		const room = new Room({ name: "test" });
		expect(await room.getRoleFromToken("fake")).toEqual(Role.UnregisteredUser);

		jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
			user_id: -1,
			isLoggedIn: true,
		});

		expect(await room.getRoleFromToken("fake")).toEqual(Role.RegisteredUser);
	});
});
