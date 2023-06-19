import roommanager, { redisStateToState } from "../../roommanager";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Room as DbRoom } from "../../models";
import { Room, RoomStateFromRedis } from "../../room";
import { AuthToken, QueueMode, Role, Visibility } from "../../../common/models/types";
import dayjs from "dayjs";
import { RoomNotFoundException } from "../../exceptions";
import storage from "../../storage";
import { ROOM_REQUEST_CHANNEL_PREFIX } from "../../../common/constants";
import { RoomRequest, RoomRequestType } from "../../../common/models/messages";
import { VideoQueue } from "../../../server/videoqueue";

describe("Room manager", () => {
	beforeEach(async () => {
		await DbRoom.destroy({ where: {} });
		for (const room of roommanager.rooms) {
			await roommanager.unloadRoom(room.name);
		}
		roommanager.clearRooms();
	});

	describe("creating a room", () => {
		it("should never save null to permissions or user role columns", async () => {
			await roommanager.createRoom({ name: "test", isTemporary: false, title: "asdf1234" });
			const room = await DbRoom.findOne({ where: { name: "test" } });
			expect(room.permissions).not.toBeNull();
			expect(room.permissions).toMatch(/^\[(\[-?\d+,\d+\],?)+\]$/);
			expect(room["role-admin"]).not.toBeNull();
			expect(room["role-mod"]).not.toBeNull();
			expect(room["role-trusted"]).not.toBeNull();
		});

		it("should be able to load saved settings from database", async () => {
			await roommanager.createRoom({
				name: "test",
				isTemporary: false,
				title: "asdf1234",
				description: "0987asdf",
				visibility: Visibility.Unlisted,
				queueMode: QueueMode.Vote,
			});
			const room = await DbRoom.findOne({ where: { name: "test" } });
			expect(room.title).toEqual("asdf1234");
			expect(room.description).toEqual("0987asdf");
			expect(room.visibility).toEqual(Visibility.Unlisted);
			expect(room.queueMode).toEqual(QueueMode.Vote);
		});
	});

	describe("loading from redis", () => {
		it("should save and load all needed props from redis", async () => {
			await roommanager.createRoom({ name: "test", isTemporary: true });
			const room = (await roommanager.getRoom("test")).unwrap();
			room.userRoles.get(Role.TrustedUser)?.add(8).add(10).add(12);
			room.userRoles.get(Role.Moderator)?.add(87).add(23);
			room.userRoles.get(Role.Administrator)?.add(9);
			room.grants.setRoleGrants(Role.UnregisteredUser, 1234);
			room.currentSource = { service: "fake", id: "video" };
			room.queue = new VideoQueue([
				{ service: "fake", id: "video2" },
				{ service: "fake", id: "video3" },
				{ service: "fake", id: "video4" },
			]);
			room.isPlaying = true;
			room._playbackStart = dayjs().subtract(10, "second");
			room.playbackPosition = 10;

			const text = room.serializeState();
			const options = JSON.parse(text) as RoomStateFromRedis;
			const loadedRoom = new Room(redisStateToState(options));
			// HACK: room constructor sets the on dirty callback, so we manually remove it here
			loadedRoom.queue.onDirty(undefined);

			expect(loadedRoom.name).toEqual(room.name);
			expect(loadedRoom.owner).toEqual(room.owner);
			expect(loadedRoom.hasOwner).toEqual(room.hasOwner);
			expect(loadedRoom.userRoles).toEqual(room.userRoles);
			expect(loadedRoom.grants).toEqual(room.grants);
			expect(loadedRoom.currentSource).toEqual(room.currentSource);
			expect(loadedRoom.queue).toEqual(room.queue);
			expect(loadedRoom.isPlaying).toEqual(room.isPlaying);
			expect(loadedRoom.playbackPosition).toEqual(room.playbackPosition);
			expect(loadedRoom._playbackStart).toEqual(room._playbackStart);
			expect(loadedRoom.realPlaybackPosition).toBeCloseTo(20, 1);
		});
	});

	it("should not load the room if it is not already loaded in memory", async () => {
		const getRoomByNameSpy = jest
			.spyOn(storage, "getRoomByName")
			.mockImplementation()
			.mockReturnValue(null);
		let result = await roommanager.getRoom("test", {
			mustAlreadyBeLoaded: true,
		});
		expect(result.ok).toEqual(false);
		expect(result.value).toBeInstanceOf(RoomNotFoundException);
		expect(getRoomByNameSpy).not.toHaveBeenCalled();
		await roommanager.createRoom({ name: "test", isTemporary: true });
		const result2 = await roommanager.getRoom("test", {
			mustAlreadyBeLoaded: true,
		});
		expect(result2.ok).toEqual(true);
		expect(getRoomByNameSpy).not.toHaveBeenCalled();
		getRoomByNameSpy.mockRestore();
	});
});
