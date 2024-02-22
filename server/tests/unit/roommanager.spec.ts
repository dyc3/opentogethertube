import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import roommanager, { redisStateToState } from "../../roommanager";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Room as DbRoom, loadModels } from "../../models";
import { Room, RoomStateFromRedis } from "../../room";
import { AuthToken, QueueMode, Role, Visibility } from "../../../common/models/types";
import dayjs from "dayjs";
import { RoomNotFoundException } from "../../exceptions";
import storage from "../../storage";
import { RoomRequest, RoomRequestType } from "../../../common/models/messages";
import { VideoQueue } from "../../../server/videoqueue";
import { buildClients } from "../../redisclient";

describe("Room manager", () => {
	beforeAll(async () => {
		loadModels();
		await buildClients();
	});

	afterEach(async () => {
		for (const room of roommanager.rooms) {
			await roommanager.unloadRoom(room.name);
		}
		roommanager.clearRooms();
	});

	describe("creating a room", () => {
		it("should never save null to permissions or user role columns", async () => {
			const roomName = "foo-76kdf943";
			await roommanager.createRoom({ name: roomName, isTemporary: false, title: "asdf1234" });
			const room = await DbRoom.findOne({ where: { name: roomName } });
			expect(room).not.toBeNull();
			expect(room?.permissions).not.toBeNull();
			expect(room?.permissions).toBeInstanceOf(Array);
			// eslint-disable-next-line vitest/no-conditional-in-test
			if (Array.isArray(room?.permissions)) {
				let roles = room?.permissions.map(p => p[0]);
				expect(roles).not.toContain(Role.Administrator);
				expect(roles).not.toContain(Role.Owner);
			}
			expect(room?.["role-admin"]).toBeInstanceOf(Array);
			expect(room?.["role-mod"]).toBeInstanceOf(Array);
			expect(room?.["role-trusted"]).toBeInstanceOf(Array);
			await room?.destroy();
		});

		it("should be able to load saved settings from database", async () => {
			const roomName = "foo-a3b5e323";
			await roommanager.createRoom({
				name: roomName,
				isTemporary: false,
				title: "asdf1234",
				description: "0987asdf",
				visibility: Visibility.Unlisted,
				queueMode: QueueMode.Vote,
			});
			const room = await DbRoom.findOne({ where: { name: roomName } });
			expect(room).not.toBeNull();
			expect(room).toMatchObject({
				name: roomName,
				title: "asdf1234",
				description: "0987asdf",
				visibility: Visibility.Unlisted,
				queueMode: QueueMode.Vote,
			});
			await room?.destroy();
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
			room.currentSource = { service: "direct", id: "video" };
			room.queue = new VideoQueue([
				{ service: "direct", id: "video2" },
				{ service: "direct", id: "video3" },
				{ service: "direct", id: "video4" },
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
		const getRoomByNameSpy = vi.spyOn(storage, "getRoomByName").mockResolvedValue(null);
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
