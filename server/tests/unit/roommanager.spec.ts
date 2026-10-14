import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import roommanager, { redisStateToState } from "../../roommanager.js";
import { Room as DbRoom, loadModels } from "../../models/index.js";
import { Room, RoomUser, type RoomStateFromRedis } from "../../room.js";
import { BehaviorOption, QueueMode, Role, Visibility } from "ott-common/models/types.js";
import dayjs from "dayjs";
import { RoomNameTakenException, RoomNotFoundException } from "../../exceptions.js";
import storage from "../../storage.js";
import { VideoQueue } from "../../../server/videoqueue.js";
import { buildClients, redisClient } from "../../redisclient.js";
import { UnloadReason } from "../../generated.js";
import { conf } from "../../ott-config.js";

describe("Room manager", () => {
	beforeAll(async () => {
		loadModels();
		await buildClients();
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		for (const room of roommanager.getRooms()) {
			await roommanager.unloadRoom(room.name, UnloadReason.Admin);
		}
		roommanager.clearRooms();
	});

	describe("concurrent loading", () => {
		it.each(["redis", "database"])("should share concurrent loads from %s", async source => {
			const roomName = "test-concurrent-load";
			const options = new Room({ name: roomName, isTemporary: true });
			options.throttledSync.cancel();
			const snapshot = options.serializeState();
			const getSpy = vi
				.spyOn(redisClient, "get")
				.mockResolvedValue(source === "redis" ? snapshot : null);
			const storageSpy = vi.spyOn(storage, "getRoomByName").mockResolvedValue(options);

			const results = await Promise.all([
				roommanager.getRoom(roomName),
				roommanager.getRoom(roomName.toUpperCase()),
				roommanager.getRoom(roomName),
			]);

			const room = results[0].unwrap();
			expect(results[1].unwrap()).toBe(room);
			expect(results[2].unwrap()).toBe(room);
			expect(roommanager.getRooms()).toEqual([room]);
			expect(getSpy).toHaveBeenCalledTimes(1);
			expect(storageSpy).toHaveBeenCalledTimes(source === "database" ? 1 : 0);
		});

		it("should allow another load after a failed load", async () => {
			const failure = new Error("Redis unavailable");
			const options = new Room({ name: "test-load-retry", isTemporary: true });
			options.throttledSync.cancel();
			vi.spyOn(redisClient, "get").mockRejectedValueOnce(failure).mockResolvedValue(null);
			vi.spyOn(storage, "getRoomByName").mockResolvedValue(options);

			const results = await Promise.allSettled([
				roommanager.getRoom("test-load-retry"),
				roommanager.getRoom("test-load-retry"),
			]);
			expect(results).toEqual([
				{ status: "rejected", reason: failure },
				{ status: "rejected", reason: failure },
			]);
			const room = (await roommanager.getRoom("test-load-retry")).unwrap();
			expect(roommanager.getRooms()).toEqual([room]);
		});

		it("should retry a room that was not found", async () => {
			const options = new Room({ name: "test-missing-retry", isTemporary: true });
			options.throttledSync.cancel();
			vi.spyOn(redisClient, "get").mockResolvedValue(null);
			vi.spyOn(storage, "getRoomByName")
				.mockResolvedValueOnce(null)
				.mockResolvedValue(options);

			expect((await roommanager.getRoom("test-missing-retry")).ok).toBe(false);
			expect((await roommanager.getRoom("test-missing-retry")).ok).toBe(true);
		});

		it("should not register a room when assigning its epoch fails", async () => {
			const options = new Room({ name: "test-epoch-retry", isTemporary: true });
			options.throttledSync.cancel();
			vi.spyOn(redisClient, "get").mockResolvedValue(options.serializeState());
			vi.spyOn(redisClient, "incr")
				.mockRejectedValueOnce(new Error("Redis unavailable"))
				.mockResolvedValue(42);

			await expect(roommanager.getRoom(options.name)).rejects.toThrow("Redis unavailable");
			expect(roommanager.getRooms()).toHaveLength(0);
			const room = (await roommanager.getRoom(options.name)).unwrap();
			expect(room.loadEpoch).toBe(42);
			expect(roommanager.getRooms()).toEqual([room]);
		});

		it("should reject creation while the same name is loading", async () => {
			const snapshot = new Room({ name: "test-loading-create", isTemporary: true });
			snapshot.throttledSync.cancel();
			let resolveGet!: (value: string) => void;
			vi.spyOn(redisClient, "get").mockReturnValue(
				new Promise(resolve => {
					resolveGet = resolve;
				}),
			);
			const loading = roommanager.getRoom(snapshot.name);

			expect(roommanager.getRooms()).toHaveLength(0);
			expect(
				(await roommanager.getRoom(snapshot.name, { mustAlreadyBeLoaded: true })).ok,
			).toBe(false);
			await expect(
				roommanager.createRoom({ name: snapshot.name.toUpperCase(), isTemporary: true }),
			).rejects.toBeInstanceOf(RoomNameTakenException);
			resolveGet(snapshot.serializeState());
			const room = (await loading).unwrap();
			expect(roommanager.getRooms()).toEqual([room]);
		});

		it("should share a pending creation with loads and reject another creation", async () => {
			let resolveExists!: (value: number) => void;
			const existsSpy = vi.spyOn(redisClient, "exists").mockReturnValue(
				new Promise(resolve => {
					resolveExists = resolve;
				}),
			);
			const getSpy = vi.spyOn(redisClient, "get");
			const created = roommanager.createRoom({ name: "test-creating", isTemporary: true });
			const loaded = roommanager.getRoom("TEST-CREATING");

			await expect(
				roommanager.createRoom({ name: "TEST-CREATING", isTemporary: true }),
			).rejects.toBeInstanceOf(RoomNameTakenException);
			resolveExists(0);
			await created;
			const room = (await loaded).unwrap();
			expect((await roommanager.getRoom("test-creating")).unwrap()).toBe(room);
			expect(roommanager.getRooms()).toEqual([room]);
			expect(existsSpy).toHaveBeenCalledTimes(1);
			expect(getSpy).not.toHaveBeenCalled();
		});

		it("should release a failed creation so it can be retried", async () => {
			vi.spyOn(redisClient, "exists")
				.mockRejectedValueOnce(new Error("Redis unavailable"))
				.mockResolvedValue(0);
			const options = { name: "test-create-retry", isTemporary: true };

			await expect(roommanager.createRoom(options)).rejects.toThrow("Redis unavailable");
			expect(roommanager.getRooms()).toHaveLength(0);
			await roommanager.createRoom(options);
			expect(roommanager.getRooms()).toHaveLength(1);
		});

		it("should unload a room after its pending load completes", async () => {
			const options = new Room({ name: "test-unload-pending", isTemporary: true });
			options.throttledSync.cancel();
			let resolveGet!: (value: string) => void;
			vi.spyOn(redisClient, "get").mockReturnValue(
				new Promise(resolve => {
					resolveGet = resolve;
				}),
			);
			const loading = roommanager.getRoom(options.name);
			const unloading = roommanager.unloadRoom(options.name, UnloadReason.Commanded);
			resolveGet(options.serializeState());
			await loading;
			await unloading;

			expect(roommanager.getRooms()).toHaveLength(0);
		});
	});

	it("should ignore an unregistered object with the same name as an occupied room", async () => {
		await roommanager.createRoom({ name: "test-duplicate", isTemporary: true });
		const occupied = (await roommanager.getRoom("test-duplicate")).unwrap();
		const stale = new Room({ name: occupied.name, isTemporary: true });
		stale.throttledSync.cancel();
		occupied.realusers.push(new RoomUser("client", "token"));
		const deleteSpy = vi.spyOn(redisClient, "del");
		const beforeUnloadSpy = vi.spyOn(stale, "onBeforeUnload");
		const unloaded = vi.fn();
		roommanager.on("unload", unloaded);

		await roommanager.unloadRoom(stale, UnloadReason.Keepalive);

		expect(roommanager.getRooms()).toEqual([occupied]);
		expect(occupied.users).toHaveLength(1);
		expect(deleteSpy).not.toHaveBeenCalled();
		expect(beforeUnloadSpy).not.toHaveBeenCalled();
		expect(unloaded).not.toHaveBeenCalled();
	});

	it("should unload every stale room in one update", async () => {
		await roommanager.createRoom({ name: "test-stale-first", isTemporary: true });
		await roommanager.createRoom({ name: "test-stale-second", isTemporary: true });
		const first = (await roommanager.getRoom("test-stale-first")).unwrap();
		const second = (await roommanager.getRoom("test-stale-second")).unwrap();
		first._keepAlivePing = dayjs().subtract(conf.get("room.unload_after") + 1, "second");
		second._keepAlivePing = first._keepAlivePing;

		await roommanager.update();

		expect(roommanager.getRooms()).toHaveLength(0);
	});

	it("should still refuse a keepalive unload for an occupied object", async () => {
		await roommanager.createRoom({ name: "test-occupied-object", isTemporary: true });
		const room = (await roommanager.getRoom("test-occupied-object")).unwrap();
		room.realusers.push(new RoomUser("client", "token"));

		await roommanager.unloadRoom(room, UnloadReason.Keepalive);

		expect(roommanager.getRooms()).toEqual([room]);
	});

	it("should ignore unloading an object that is no longer loaded", async () => {
		await roommanager.createRoom({ name: "test-unloaded-object", isTemporary: true });
		const room = (await roommanager.getRoom("test-unloaded-object")).unwrap();
		await roommanager.unloadRoom(room, UnloadReason.Admin);
		await roommanager.createRoom({ name: room.name, isTemporary: true });
		const other = (await roommanager.getRoom(room.name)).unwrap();

		await roommanager.unloadRoom(room, UnloadReason.Commanded);

		expect(roommanager.getRooms()).toEqual([other]);
	});

	it("should emit the loaded object with its assigned epoch", async () => {
		const loaded = vi.fn();
		roommanager.on("load", loaded);
		await roommanager.createRoom({ name: "test-load-event", isTemporary: true });
		const room = (await roommanager.getRoom("test-load-event")).unwrap();

		expect(loaded).toHaveBeenCalledWith(room);
		expect(room.loadEpoch).toBeGreaterThan(0);
	});

	describe("creating a room", () => {
		it(
			"should never save null to permissions or user role columns",
			async () => {
				const roomName = "foo-76kdf943";
				await roommanager.createRoom({
					name: roomName,
					isTemporary: false,
					title: "asdf1234",
				});
				const room = await DbRoom.findOne({ where: { name: roomName } });
				expect(room).not.toBeNull();
				expect(room?.permissions).not.toBeNull();
				expect(room?.permissions).toBeInstanceOf(Array);
				// eslint-disable-next-line vitest/no-conditional-in-test
				if (Array.isArray(room?.permissions)) {
					const roles = room?.permissions.map(p => p[0]);
					expect(roles).not.toContain(Role.Administrator);
					expect(roles).not.toContain(Role.Owner);
				}
				expect(room?.["role-admin"]).toBeInstanceOf(Array);
				expect(room?.["role-mod"]).toBeInstanceOf(Array);
				expect(room?.["role-trusted"]).toBeInstanceOf(Array);
				await room?.destroy();
			},
			{ retry: 2 },
		);

		it(
			"should be able to load saved settings from database",
			async () => {
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
			},
			{ retry: 2 },
		);
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

		it("should preserve empty prevQueue on unload and reload when current queue is empty", async () => {
			const roomName = "test-prevqueue-empty";
			try {
				await roommanager.createRoom({ name: roomName, isTemporary: false });
				const room = (await roommanager.getRoom(roomName)).unwrap();

				room.prevQueue = [{ service: "direct", id: "foo" }];
				room.queue = new VideoQueue([]);

				await room.sync();

				let dbRoom = await DbRoom.findOne({ where: { name: roomName } });
				expect(dbRoom).not.toBeNull();
				expect(dbRoom?.prevQueue).toEqual([{ service: "direct", id: "foo" }]);

				// prevQueue becomes null in "room.onBeforeUnload()" if prevQueue.length is 0
				await roommanager.unloadRoom(roomName, UnloadReason.Keepalive);

				dbRoom = await DbRoom.findOne({ where: { name: roomName } });
				expect(dbRoom).not.toBeNull();
				expect(dbRoom?.prevQueue).toBeNull();

				const loaded = (await roommanager.getRoom(roomName)).unwrap();
				expect(loaded.prevQueue).toBeNull();
			} finally {
				await DbRoom.destroy({ where: { name: roomName } });
			}
		});

		it("should preserve redis state when commanded to unload", async () => {
			const roomName = "test-commanded-unload-preserve-redis";
			await roommanager.createRoom({ name: roomName, isTemporary: true });
			const room = (await roommanager.getRoom(roomName)).unwrap();
			await room.queue.enqueue({ service: "direct", id: "video" });
			await room.sync();
			await room.saveStateToRedisDebounced.flush();

			expect(await redisClient.exists(`room:${roomName}`)).toEqual(1);

			await roommanager.unloadRoom(roomName, UnloadReason.Commanded);

			expect(await redisClient.exists(`room:${roomName}`)).toEqual(1);

			const loaded = (await roommanager.getRoom(roomName)).unwrap();
			expect(loaded.queue.items).toEqual([{ service: "direct", id: "video" }]);
		});

		it("should recover the current queue from the database after abrupt loss", async () => {
			const roomName = "test-abrupt-room-loss";
			try {
				await roommanager.createRoom({
					name: roomName,
					isTemporary: false,
					restoreQueueBehavior: BehaviorOption.Always,
				});
				const room = (await roommanager.getRoom(roomName)).unwrap();
				room.currentSource = { service: "direct", id: "video1" };
				room.queue = new VideoQueue([
					{ service: "direct", id: "video2" },
					{ service: "direct", id: "video3" },
				]);
				await room.sync();
				const saved = await DbRoom.findOne({ where: { name: roomName } });
				expect(saved?.prevQueue).toEqual([
					{ service: "direct", id: "video1", startAt: 0 },
					{ service: "direct", id: "video2" },
					{ service: "direct", id: "video3" },
				]);

				// Simulate an abrupt monolith loss after its Redis snapshot has expired.
				roommanager.clearRooms();
				await redisClient.del(`room:${roomName}`);
				const loaded = (await roommanager.getRoom(roomName)).unwrap();
				await loaded.update();
				expect(loaded.currentSource).toEqual({
					service: "direct",
					id: "video1",
					startAt: 0,
				});
				expect(loaded.queue.items).toEqual([
					{ service: "direct", id: "video2" },
					{ service: "direct", id: "video3" },
				]);
			} finally {
				await redisClient.del(`room:${roomName}`);
				await DbRoom.destroy({ where: { name: roomName } });
			}
		});

		it("should clear the database recovery queue when the current queue is emptied", async () => {
			const roomName = "test-empty-recovery-queue";
			try {
				await roommanager.createRoom({ name: roomName, isTemporary: false });
				const room = (await roommanager.getRoom(roomName)).unwrap();
				await room.queue.enqueue({ service: "direct", id: "video" });
				await room.sync();
				expect((await DbRoom.findOne({ where: { name: roomName } }))?.prevQueue).toEqual([
					{ service: "direct", id: "video" },
				]);

				await room.queue.dequeue();
				await room.sync();
				expect((await DbRoom.findOne({ where: { name: roomName } }))?.prevQueue).toBeNull();
			} finally {
				await redisClient.del(`room:${roomName}`);
				await DbRoom.destroy({ where: { name: roomName } });
			}
		});
	});

	it("should not load the room if it is not already loaded in memory", async () => {
		const getRoomByNameSpy = vi.spyOn(storage, "getRoomByName").mockResolvedValue(null);
		const result = await roommanager.getRoom("test", {
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

	it("should ignore a duplicate commanded unload", async () => {
		const roomName = "test-duplicate-commanded-unload";
		await roommanager.createRoom({ name: roomName, isTemporary: true });

		await roommanager.unloadRoom(roomName, UnloadReason.Commanded);

		await expect(
			roommanager.unloadRoom(roomName, UnloadReason.Commanded),
		).resolves.toBeUndefined();
	});
});
