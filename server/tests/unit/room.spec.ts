import dayjs from "dayjs";
import tokens from "../../auth/tokens";
import { RoomRequestType } from "../../../common/models/messages";
import { BehaviorOption, QueueMode, Role } from "../../../common/models/types";
import { Room, RoomUser } from "../../room";
import infoextractor from "../../infoextractor";
import { Video, VideoId } from "../../../common/models/video";
import permissions from "../../../common/permissions";
import _ from "lodash";
import { VideoQueue } from "../../videoqueue";
import { loadModels } from "../../models";
import { buildClients } from "../../redisclient";

describe("Room", () => {
	let getSessionInfoSpy: jest.SpyInstance;
	let validateSpy: jest.SpyInstance;
	beforeAll(async () => {
		loadModels();
		await buildClients();

		getSessionInfoSpy = jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			username: "test",
			isLoggedIn: false,
		});
		validateSpy = jest.spyOn(tokens, "validate").mockResolvedValue(true);
	});

	afterAll(() => {
		getSessionInfoSpy.mockRestore();
		validateSpy.mockRestore();
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
			user = new RoomUser("user", "a");
			user.token = "asdf1234";
			room = new Room({ name: "test" });
			room.realusers = [user];
			// because we aren't testing the permission system, grant all the permissions
			room.grants.setRoleGrants(Role.UnregisteredUser, permissions.parseIntoGrantMask(["*"]));
		});

		describe("PlaybackRequest", () => {
			it("should play and pause", async () => {
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlaybackRequest,
						state: true,
					},
					{ token: user.token }
				);
				expect(room.isPlaying).toEqual(true);
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlaybackRequest,
						state: false,
					},
					{ token: user.token }
				);
				expect(room.isPlaying).toEqual(false);
			});

			it("should advance playback position", async () => {
				room.isPlaying = true;
				room._playbackStart = dayjs().subtract(5, "second");
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlaybackRequest,
						state: false,
					},
					{ token: user.token }
				);
				expect(room.isPlaying).toEqual(false);
				expect(room.playbackPosition).toBeCloseTo(5, 1);
				expect(room.playbackPosition).toBeGreaterThanOrEqual(5);
			});
		});

		describe("SkipRequest", () => {
			beforeEach(() => {
				room.currentSource = {
					service: "direct",
					id: "video",
				};
			});

			it("skip with empty queue", async () => {
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.SkipRequest,
					},
					{ token: user.token }
				);
				expect(room.currentSource).toBeNull();
			});

			it("skip with non-empty queue", async () => {
				room.queue = new VideoQueue([
					{
						service: "direct",
						id: "video2",
					},
				]);
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.SkipRequest,
					},
					{ token: user.token }
				);
				expect(room.currentSource).toEqual({
					service: "direct",
					id: "video2",
				});
			});
		});

		describe("SeekRequest", () => {
			it("should seek", async () => {
				room.playbackPosition = 10;
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.SeekRequest,
						value: 15,
					},
					{ token: user.token }
				);
				expect(room.playbackPosition).toEqual(15);
			});

			it.each([undefined, null])("should not seek if value is %s", async v => {
				room.playbackPosition = 10;
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.SeekRequest,
						value: v as unknown as number,
					},
					{ token: user.token }
				);
				expect(room.playbackPosition).toEqual(10);
			});
		});

		describe("PlayNowRequest", () => {
			const videoToPlay: Video = {
				service: "direct",
				id: "video",
				title: "play me now",
				description: "test",
				thumbnail: "test",
				length: 10,
			};

			it("should place the requested video in currentSource", async () => {
				jest.spyOn(infoextractor, "getVideoInfo").mockResolvedValue(videoToPlay);
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlayNowRequest,
						video: videoToPlay,
					},
					{ token: user.token }
				);
				expect(room.currentSource).toEqual(videoToPlay);
			});

			it("should remove the video from the queue", async () => {
				jest.spyOn(infoextractor, "getVideoInfo").mockResolvedValue(videoToPlay);
				room.currentSource = {
					service: "direct",
					id: "asdf123",
				};
				room.queue = new VideoQueue([videoToPlay]);
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlayNowRequest,
						video: videoToPlay,
					},
					{ token: user.token }
				);
				for (const video of room.queue.items) {
					expect(video).not.toEqual(videoToPlay);
				}
				expect(room.currentSource).toEqual(videoToPlay);
			});

			it("should push the currently playing video into the queue", async () => {
				jest.spyOn(infoextractor, "getVideoInfo").mockResolvedValue(videoToPlay);
				room.currentSource = {
					service: "direct",
					id: "asdf123",
				};
				room.queue = new VideoQueue([videoToPlay]);
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlayNowRequest,
						video: videoToPlay,
					},
					{ token: user.token }
				);
				expect(_.pick(room.queue.items[0], "service", "id")).toEqual({
					service: "direct",
					id: "asdf123",
				});
				for (const video of room.queue.items) {
					expect(video).not.toEqual(videoToPlay);
				}
				expect(room.currentSource).toEqual(videoToPlay);
			});

			it("should reset playback position to 0", async () => {
				jest.spyOn(infoextractor, "getVideoInfo").mockResolvedValue(videoToPlay);
				room.currentSource = {
					service: "direct",
					id: "asdf123",
				};
				room.playbackPosition = 10;
				room.queue = new VideoQueue([videoToPlay]);
				await room.processUnauthorizedRequest(
					{
						type: RoomRequestType.PlayNowRequest,
						video: videoToPlay,
					},
					{ token: user.token }
				);
				expect(room.currentSource).toEqual(videoToPlay);
				expect(room.playbackPosition).toEqual(0);
			});
		});

		describe("VoteRequest", () => {
			it("should only cast one vote when a video is voted for the first time", async () => {
				await room.processRequest(
					{
						type: RoomRequestType.VoteRequest,
						video: { service: "direct", id: "abc123" },
						add: true,
					},
					{ username: "test", role: Role.Owner, clientId: "1234" }
				);
				expect(Array.from(room.votes.get("directabc123")!)).toEqual(["1234"]);
			});
		});

		describe("ShuffleRequest", () => {
			let shuffleSpy;

			beforeEach(() => {
				room.queue = new VideoQueue([
					{ service: "direct", id: "video1" },
					{ service: "direct", id: "video2" },
					{ service: "direct", id: "video3" },
					{ service: "direct", id: "video4" },
					{ service: "direct", id: "video5" },
				]);
				shuffleSpy = jest.spyOn(_, "shuffle");
			});

			afterEach(() => {
				shuffleSpy.mockRestore();
			});

			it("should not leave videos in the same order", async () => {
				await room.processRequest(
					{
						type: RoomRequestType.ShuffleRequest,
					},
					{ username: "test", role: Role.Owner, clientId: "1234" }
				);
				expect(shuffleSpy).toHaveBeenCalled();
				expect(room.queue).toHaveLength(5);
			});
		});

		describe("PlaybackSpeedRequest", () => {
			it("should set the playback speed", async () => {
				await room.processRequest(
					{
						type: RoomRequestType.PlaybackSpeedRequest,
						speed: 1.5,
					},
					{ username: "test", role: Role.Owner, clientId: "1234" }
				);
				expect(room.playbackSpeed).toEqual(1.5);

				await room.processRequest(
					{
						type: RoomRequestType.PlaybackSpeedRequest,
						speed: 1,
					},
					{ username: "test", role: Role.Owner, clientId: "1234" }
				);
				expect(room.playbackSpeed).toEqual(1);
			});
		});

		describe("RestoreQueueRequest", () => {
			it("should restore the queue", async () => {
				const prevQueue: VideoId[] = [
					{ service: "direct", id: "video1" },
					{ service: "direct", id: "video2" },
					{ service: "direct", id: "video3" },
					{ service: "direct", id: "video4" },
					{ service: "direct", id: "video5" },
				];
				room.prevQueue = _.cloneDeep(prevQueue);
				await room.processRequest(
					{
						type: RoomRequestType.RestoreQueueRequest,
					},
					{ username: "test", role: Role.Owner, clientId: "1234" }
				);
				expect(room.queue.items).toEqual(prevQueue);
				expect(room.prevQueue).toBeNull();
			});

			it("should discard the queue", async () => {
				room.prevQueue = [
					{ service: "direct", id: "video1" },
					{ service: "direct", id: "video2" },
					{ service: "direct", id: "video3" },
					{ service: "direct", id: "video4" },
					{ service: "direct", id: "video5" },
				];
				await room.processRequest(
					{
						type: RoomRequestType.RestoreQueueRequest,
						discard: true,
					},
					{ username: "test", role: Role.Owner, clientId: "1234" }
				);
				expect(room.queue.items).not.toEqual(room.prevQueue);
				expect(room.queue.items).toEqual([]);
				expect(room.prevQueue).toBeNull();
			});
		});
	});

	describe("auto dequeuing next video", () => {
		let room: Room;

		beforeEach(() => {
			room = new Room({ name: "test" });
			room.currentSource = {
				service: "direct",
				id: "video",
			};
			room.queue = new VideoQueue([
				{
					service: "direct",
					id: "video2",
				},
			]);
		});

		it.each([QueueMode.Manual, QueueMode.Vote])(
			"should consume the current item when mode is %s",
			async mode => {
				room.queueMode = mode;
				await room.dequeueNext();
				expect(room.currentSource).toEqual({
					service: "direct",
					id: "video2",
				});
				expect(room.queue).toHaveLength(0);
			}
		);

		it.each([QueueMode.Loop])("should requeue the current item when mode is %s", async mode => {
			room.queueMode = mode;
			await room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "direct",
				id: "video2",
			});
			expect(room.queue).toHaveLength(1);
			expect(room.queue.items[0]).toEqual({
				service: "direct",
				id: "video",
			});
		});

		it.each([QueueMode.Dj])("should restart the current item when mode is %s", async mode => {
			room.queueMode = mode;
			room.playbackPosition = 10;
			await room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "direct",
				id: "video",
			});
			expect(room.playbackPosition).toEqual(0);
			expect(room.queue).toHaveLength(1);
			expect(room.queue.items[0]).toEqual({
				service: "direct",
				id: "video2",
			});
		});

		it.each([QueueMode.Loop])(
			"should requeue the current item when mode is %s, with empty queue",
			async mode => {
				room.queueMode = mode;
				room.queue = new VideoQueue();
				expect(room.queue).toHaveLength(0);
				await room.dequeueNext();
				expect(room.currentSource).toEqual({
					service: "direct",
					id: "video",
				});
				expect(room.queue).toHaveLength(0);
			}
		);
	});

	it("should be able to get role in unowned room", async () => {
		jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			username: "test",
			isLoggedIn: false,
		});

		const room = new Room({ name: "test" });
		expect(await room.getRoleFromToken("fake")).toEqual(Role.UnregisteredUser);

		jest.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			user_id: -1,
			isLoggedIn: true,
		});

		expect(await room.getRoleFromToken("fake")).toEqual(Role.RegisteredUser);
	});

	describe("restore queue behavior", () => {
		it("should always restore the queue when behavior is always", async () => {
			const room = new Room({
				name: "test",
				prevQueue: [{ service: "direct", id: "foo" }],
				restoreQueueBehavior: BehaviorOption.Always,
			});

			expect(room.queue.items).toEqual([{ service: "direct", id: "foo" }]);
			expect(room.prevQueue).toBeNull();
		});

		it("should never restore the queue when behavior is never", async () => {
			const room = new Room({
				name: "test",
				prevQueue: [{ service: "direct", id: "foo" }],
				restoreQueueBehavior: BehaviorOption.Never,
			});

			expect(room.queue.items).toEqual([]);
			expect(room.prevQueue).toBeNull();
		});

		it("should never overwrite an existing queue when behavior is always", async () => {
			const room = new Room({
				name: "test",
				// @ts-expect-error testing restoring from redis
				queue: [{ service: "direct", id: "bar" }],
				prevQueue: [{ service: "direct", id: "foo" }],
				restoreQueueBehavior: BehaviorOption.Always,
			});

			expect(room.queue.items).toEqual([{ service: "direct", id: "bar" }]);
		});
	});

	describe("vote skip", () => {
		it("should add a vote when vote skip is enabled", async () => {
			const room = new Room({
				name: "test",
				enableVoteSkip: true,
			});
			room.currentSource = { service: "direct", id: "foo" };
			room.realusers = [
				new RoomUser("user", "a"),
				new RoomUser("user2", "b"),
				new RoomUser("user3", "c"),
			];

			await room.processRequest(
				{
					type: RoomRequestType.SkipRequest,
				},
				{
					username: "user",
					role: Role.UnregisteredUser,
					clientId: "user",
				}
			);

			expect(room.currentSource).toEqual({ service: "direct", id: "foo" });
			expect(room.votesToSkip.has("user")).toEqual(true);
		});

		it("should skip when enough votes are cast", async () => {
			const room = new Room({
				name: "test",
				enableVoteSkip: true,
			});
			room.currentSource = { service: "direct", id: "foo" };
			room.realusers = [
				new RoomUser("user", "a"),
				new RoomUser("user2", "b"),
				new RoomUser("user3", "c"),
			];

			await room.processRequest(
				{
					type: RoomRequestType.SkipRequest,
				},
				{
					username: "user",
					role: Role.UnregisteredUser,
					clientId: "user",
				}
			);
			await room.processRequest(
				{
					type: RoomRequestType.SkipRequest,
				},
				{
					username: "user2",
					role: Role.UnregisteredUser,
					clientId: "user2",
				}
			);

			expect(room.currentSource).toEqual(null);
			expect(room.votesToSkip.size).toEqual(0);
		});
	});
});
