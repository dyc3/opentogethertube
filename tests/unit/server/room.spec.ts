import { Room } from "../../../server/room";

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
});
