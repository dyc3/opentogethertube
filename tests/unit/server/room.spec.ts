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

		it("PlaybackRequest", async () => {
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
	});
});
