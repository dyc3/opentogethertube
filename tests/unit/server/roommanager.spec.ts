import roommanager from "../../../server/roommanager";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Room as DbRoom } from "../../../models";
import { Room } from "../../../server/room";
import { Role } from "../../../common/models/types";
import dayjs from "dayjs";

describe("Room manager", () => {
	beforeEach(async () => {
		await DbRoom.destroy({ where: {} });
	});

	describe("creating a room", () => {
		it("should never save null to permissions or user role columns", async () => {
			await roommanager.CreateRoom({ name: "test", isTemporary: false });
			const room = await DbRoom.findOne({ where: { name: "test" } });
			expect(room.permissions).not.toBeNull();
			expect(room.permissions).toEqual('{"0":4095,"1":4095,"2":4095,"3":3149823,"4":4194303,"-1":4194303}');
			expect(room["role-admin"]).not.toBeNull();
			expect(room["role-mod"]).not.toBeNull();
			expect(room["role-trusted"]).not.toBeNull();
		});
	});

	describe("loading from redis", () => {
		it("should save and load all needed props from redis", async () => {
			await roommanager.CreateRoom({ name: "test", isTemporary: true });
			const room = await roommanager.GetRoom("test");
			room.userRoles.get(Role.TrustedUser).add(8).add(10).add(12);
			room.userRoles.get(Role.Moderator).add(87).add(23);
			room.userRoles.get(Role.Administrator).add(9);
			room.grants.setRoleGrants(Role.UnregisteredUser, 1234);
			room.currentSource = { service: "fake", id: "video" };
			room.queue = [
				{ service: "fake", id: "video2" },
				{ service: "fake", id: "video3" },
				{ service: "fake", id: "video4" },
			];
			room.isPlaying = true;
			room._playbackStart = dayjs().subtract(10, "second");
			room.playbackPosition = 10;

			const text = room.serializeState();
			const options = JSON.parse(text);
			const loadedRoom = new Room(options);

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
});
