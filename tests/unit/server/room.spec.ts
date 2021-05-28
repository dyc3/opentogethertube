import dayjs from "dayjs";
import { RoomRequestType } from "../../../common/models/messages";
import { Room, RoomUser } from "../../../server/room";

describe("Room", () => {
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
			room = new Room({ name: "test" });
			room.realusers = [user];
		});

		describe("PlaybackRequest", () => {
			it("should play and pause", async () => {
				await room.processRequest({
					type: RoomRequestType.PlaybackRequest,
					client: user.id,
					state: true,
				});
				expect(room.isPlaying).toEqual(true);
				await room.processRequest({
					type: RoomRequestType.PlaybackRequest,
					client: user.id,
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
					state: false,
				});
				expect(room.isPlaying).toEqual(false);
				expect(room.playbackPosition).toBeCloseTo(5);
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
					value: 15,
				});
				expect(room.playbackPosition).toEqual(15);
			});

			it.each([undefined, null])("should not seek if value is %s", async (v) => {
				room.playbackPosition = 10;
				await room.processRequest({
					type: RoomRequestType.SeekRequest,
					client: user.id,
					value: v,
				});
				expect(room.playbackPosition).toEqual(10);
			});
		});
	});
});
