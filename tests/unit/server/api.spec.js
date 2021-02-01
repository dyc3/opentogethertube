const request = require('supertest');
const roommanager = require('../../../roommanager.js');
jest.spyOn(roommanager, "getAllLoadedRooms").mockReturnValue(Promise.resolve([]));
const app = require('../../../app.js').app;
const InfoExtract = require('../../../server/infoextractor');
const { Room, User } = require("../../../models");
const usermanager = require('../../../usermanager.js');

const TEST_API_KEY = "TESTAPIKEY";

describe("Room API", () => {
	beforeAll(async () => {
		await User.destroy({ where: {} });

		await usermanager.registerUser({
			email: "forced@localhost",
			username: "forced test user",
			password: "test1234",
		});
	});

	beforeEach(() => {
		roommanager.unloadRoom("test");
		roommanager.unloadRoom("test1");
		roommanager.unloadRoom("test2");
		roommanager.unloadRoom("test3");
	});

	describe("GET /room/list", () => {
		beforeAll(() => {
			process.env.OPENTOGETHERTUBE_API_KEY = TEST_API_KEY;
		});

		beforeEach(() => {
			roommanager.unloadRoom("test");
			roommanager.unloadRoom("test1");
			roommanager.unloadRoom("test2");
			roommanager.unloadRoom("test3");
		});

		it("should get 0 rooms", async () => {
			await request(app)
				.get("/api/room/list")
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body).toHaveLength(0);
				});
		});

		it("should get 3 public rooms", async () => {
			await roommanager.createRoom("test1", true);
			await roommanager.createRoom("test2", true);
			await roommanager.createRoom("test3", true);
			roommanager.rooms[0].clients = [{}];

			await request(app)
				.get("/api/room/list")
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body).toHaveLength(3);
					expect(resp.body[0]).toEqual({
						name: "test1",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "public",
						queueMode: "manual",
						currentSource: {},
						users: 1,
					});
					expect(resp.body[1]).toEqual({
						name: "test2",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "public",
						queueMode: "manual",
						currentSource: {},
						users: 0,
					});
					expect(resp.body[2]).toEqual({
						name: "test3",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "public",
						queueMode: "manual",
						currentSource: {},
						users: 0,
					});
				});

			roommanager.unloadRoom("test1");
			roommanager.unloadRoom("test2");
			roommanager.unloadRoom("test3");
		});

		it("should get 1 public room and exclude unlisted and private rooms", async () => {
			await roommanager.createRoom("test1", true, "public");
			await roommanager.createRoom("test2", true, "unlisted");
			await roommanager.createRoom("test3", true, "private");

			await request(app)
				.get("/api/room/list")
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body).toHaveLength(1);
					expect(resp.body[0]).toEqual({
						name: "test1",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "public",
						queueMode: "manual",
						currentSource: {},
						users: 0,
					});
				});

			roommanager.unloadRoom("test1");
			roommanager.unloadRoom("test2");
			roommanager.unloadRoom("test3");
		});

		it("should get all room if valid api key is provided", async () => {
			await roommanager.createRoom("test1", true, "public");
			await roommanager.createRoom("test2", true, "unlisted");
			await roommanager.createRoom("test3", true, "private");

			await request(app)
				.get("/api/room/list")
				.set("apikey", TEST_API_KEY)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body).toHaveLength(3);
					expect(resp.body[0]).toEqual({
						name: "test1",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "public",
						queueMode: "manual",
						currentSource: {},
						users: 0,
					});
					expect(resp.body[1]).toEqual({
						name: "test2",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "unlisted",
						queueMode: "manual",
						currentSource: {},
						users: 0,
					});
					expect(resp.body[2]).toEqual({
						name: "test3",
						title: "",
						description: "",
						isTemporary: true,
						visibility: "private",
						queueMode: "manual",
						currentSource: {},
						users: 0,
					});
				});

			roommanager.unloadRoom("test1");
			roommanager.unloadRoom("test2");
			roommanager.unloadRoom("test3");
		});
	});

	it("GET /room/:name", async done => {
		await roommanager.createRoom("test1", true);

		await request(app)
			.get("/api/room/test1")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.name).toBe("test1");
				expect(resp.body.title).toBe("");
				expect(resp.body.description).toBe("");
				expect(resp.body.queueMode).toBe("manual");
				expect(resp.body.visibility).toBe("public");
			});

		roommanager.unloadRoom("test1");

		await roommanager.createRoom("test1", true, "unlisted");

		await request(app)
			.get("/api/room/test1")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.name).toBe("test1");
				expect(resp.body.title).toBe("");
				expect(resp.body.description).toBe("");
				expect(resp.body.queueMode).toBe("manual");
				expect(resp.body.visibility).toBe("unlisted");
			});

		roommanager.unloadRoom("test1", true);

		await request(app)
			.get("/api/room/test1")
			.expect("Content-Type", /json/)
			.expect(404)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: "Room not found",
				});
			});

		done();
	});

	it("POST /room/create", async done => {
		await request(app)
			.post("/api/room/create")
			.send({ name: "test1", temporary: true, visibility: "public" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBe(true);
				expect(roommanager.rooms[0].name).toBe("test1");
				expect(roommanager.rooms[0].isTemporary).toBe(true);
				expect(roommanager.rooms[0].visibility).toBe("public");
			});

		roommanager.unloadRoom("test1", true);

		await request(app)
			.post("/api/room/create")
			.send({ name: "test1", temporary: true, visibility: "unlisted" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBe(true);
				expect(roommanager.rooms[0].name).toBe("test1");
				expect(roommanager.rooms[0].isTemporary).toBe(true);
				expect(roommanager.rooms[0].visibility).toBe("unlisted");
			});

		roommanager.unloadRoom("test1", true);

		await request(app)
			.post("/api/room/create")
			.send({ name: "test1", temporary: true, visibility: "invalid" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
			});

		await request(app)
			.post("/api/room/create")
			.send({ temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error.message).toContain("Missing argument");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "a", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error.message).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "list", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error.message).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "create", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error.message).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "generate", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error.message).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "?><>J", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error.message).toContain("not allowed");
			});

		// should create permanent room without owner
		await request(app)
			.post("/api/room/create")
			.send({ name: "testnoowner" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
				expect(roommanager.rooms[0].name).toBe("testnoowner");
				expect(roommanager.rooms[0].owner).toBeNull();
			});
		await Room.destroy({ where: { name: "testnoowner" } });
		roommanager.unloadRoom("testnoowner");

		// should create permanent room with owner
		let cookies;
		await request(app)
			.get("/api/user/test/forceLogin")
			.expect(200)
			.then(resp => {
				cookies = resp.header["set-cookie"];
			});
		await request(app)
			.post("/api/room/create")
			.set("Cookie", cookies)
			.send({ name: "testowner" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
				expect(roommanager.rooms[0].name).toBe("testowner");
				expect(roommanager.rooms[0].owner.email).toBe("forced@localhost");
			});
		await Room.destroy({ where: { name: "testowner" } });
		roommanager.unloadRoom("testowner");

		done();
	});

	it("POST /room/generate", done => {
		request(app)
			.post("/api/room/generate")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBe(true);
				expect(resp.body.room).toBeDefined();
				done();
			});
	});

	describe("PATCH /room/:name", () => {
		it("should modify permissions", async () => {
			await roommanager.createRoom("test1", true);

			await request(app)
				.patch("/api/room/test1")
				.send({
					permissions: {
						0: 0,
					},
				})
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		// TODO: move into multiple tests
		it("should work", async () => {
			await roommanager.createRoom("test1", true);

			await request(app)
				.patch("/api/room/test1")
				.send({ title: "Test" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});

			roommanager.unloadRoom("test1");

			await roommanager.createRoom("test1", true);

			await request(app)
				.patch("/api/room/test1")
				.send({ visibility: "unlisted" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
			await request(app)
				.patch("/api/room/test1")
				.send({ visibility: "invalid" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
				});

			roommanager.unloadRoom("test1");

			await roommanager.createRoom("test1", true);

			await request(app)
				.patch("/api/room/test1")
				.send({ queueMode: "vote" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
			await request(app)
				.patch("/api/room/test1")
				.send({ queueMode: "invalid" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
				});

			roommanager.unloadRoom("test1");

			await request(app)
				.patch("/api/room/test1")
				.send({ title: "Test" })
				.expect("Content-Type", /json/)
				.expect(404)
				.then(resp => {
					expect(resp.body).toEqual({
						success: false,
						error: "Room not found",
					});
				});
		});
	});

	it("DELETE /room/:name", async done => {
		await roommanager.createRoom("test1", true);

		await request(app)
			.delete("/api/room/test1")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBe(true);
			});

		await request(app)
			.delete("/api/room/test1")
			.expect("Content-Type", /json/)
			.expect(404)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: "Room not found",
				});
			});

		done();
	});

	describe("POST /room/:name/queue", () => {
		it("should add the video to the queue", async () => {
			await roommanager.createRoom("test1", true);

			await request(app)
				.post("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should add the video to the queue by url", async () => {
			await roommanager.createRoom("test1", true);

			await request(app)
				.post("/api/room/test1/queue")
				.send({ url: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should add many videos to the queue", async () => {
			let videos = [
				{ service: "youtube", id: "fake1" },
				{ service: "youtube", id: "fake2" },
			];
			let getManyVideoInfoSpy = jest.spyOn(InfoExtract, 'getManyVideoInfo').mockResolvedValue(videos);
			await roommanager.createRoom("test1", true);

			await request(app)
				.post("/api/room/test1/queue")
				.send({
					videos,
				})
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});

			getManyVideoInfoSpy.mockRestore();
		});

		it("should fail when the room is not there", async () => {
			await request(app)
				.post("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(404)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Room not found");
				});
		});

		it("should fail when invalid paramenters are given", async () => {
			await roommanager.createRoom("test1", true);

			await request(app)
				.post("/api/room/test1/queue")
				.send({ service: "direct" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Invalid parameters");
				});
		});

		it("should fail with PermissionDeniedException", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.permissions[0] = 0;

			await request(app)
				.post("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual({
						name: "PermissionDeniedException",
						message: "Permission denied: manage-queue.add",
					});
				});
		});

		it("should fail when something unexpected happens", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			jest.spyOn(room, 'addToQueue').mockRejectedValue(new Error("fake unknown error"));

			await request(app)
				.post("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(500)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Failed to get video");
				});
		});
	});

	describe("DELETE /room/:name/queue", () => {
		it("should remove video from the queue", async () => {
			await roommanager.createRoom("test1", true);
			let video = { service: "direct", id: "https://example.com/test.mp4" };

			let room = await roommanager.getOrLoadRoom("test1");
			room.queue = [video];

			await request(app)
				.delete("/api/room/test1/queue")
				.send(video)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should remove video from the queue based on url", async () => {
			await roommanager.createRoom("test1", true);
			let video = { url: "https://example.com/test.mp4" };

			let room = await roommanager.getOrLoadRoom("test1");
			room.queue = [video];

			await request(app)
				.delete("/api/room/test1/queue")
				.send(video)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should fail when the room is not there", async () => {
			await request(app)
				.delete("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(404)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Room not found");
				});
		});

		it("should fail when invalid paramenters are given", async () => {
			await roommanager.createRoom("test1", true);

			await request(app)
				.delete("/api/room/test1/queue")
				.send({ service: "direct" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Invalid parameters");
				});
		});

		it("should fail with PermissionDeniedException", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.permissions[0] = 0;

			await request(app)
				.delete("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual({
						name: "PermissionDeniedException",
						message: "Permission denied: manage-queue.remove",
					});
				});
		});

		it("should fail when something unexpected happens", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			jest.spyOn(room, 'removeFromQueue').mockImplementation(() => {
				throw new Error("fake unknown error");
			});

			await request(app)
				.delete("/api/room/test1/queue")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(500)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Failed to get video");
				});
		});
	});

	describe("POST /room/:name/vote", () => {
		it("should add vote to video", async () => {
			await roommanager.createRoom("test1", true);
			let video = { service: "direct", id: "https://example.com/test.mp4" };

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";
			room.queue = [video];

			await request(app)
				.post("/api/room/test1/vote")
				.send(video)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should fail when the room is not there", async () => {
			await request(app)
				.post("/api/room/test1/vote")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(404)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Room not found");
				});
		});

		it("should soft fail when not in vote mode", async () => {
			// FIXME: this bahavior unintuitive, and should probably be changed.
			await roommanager.createRoom("test1", true);
			let video = { service: "direct", id: "https://example.com/test.mp4" };

			let room = await roommanager.getOrLoadRoom("test1");
			room.queue = [video];

			await request(app)
				.post("/api/room/test1/vote")
				.send(video)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(false);
				});
		});

		it("should fail when invalid paramenters are given", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";

			await request(app)
				.post("/api/room/test1/vote")
				.send({ service: "direct" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Invalid parameters");
				});
		});

		it("should fail with PermissionDeniedException", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";
			room.permissions[0] = 0;

			await request(app)
				.post("/api/room/test1/vote")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual({
						name: "PermissionDeniedException",
						message: "Permission denied: manage-queue.vote",
					});
				});
		});

		it("should fail when something unexpected happens", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";
			jest.spyOn(room, 'voteVideo').mockImplementation(() => {
				throw new Error("fake unknown error");
			});

			await request(app)
				.post("/api/room/test1/vote")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(500)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Failed to get room");
				});
		});
	});

	describe("DELETE /room/:name/vote", () => {
		it("should remove video vote", async () => {
			await roommanager.createRoom("test1", true);
			let video = { service: "direct", id: "https://example.com/test.mp4" };

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";
			room.queue = [video];

			await request(app)
				.delete("/api/room/test1/vote")
				.send(video)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(true);
				});
		});

		it("should fail when the room is not there", async () => {
			await request(app)
				.delete("/api/room/test1/vote")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(404)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Room not found");
				});
		});

		it("should soft fail when not in vote mode", async () => {
			// FIXME: this bahavior unintuitive, and should probably be changed.
			await roommanager.createRoom("test1", true);
			let video = { service: "direct", id: "https://example.com/test.mp4" };

			let room = await roommanager.getOrLoadRoom("test1");
			room.queue = [video];

			await request(app)
				.delete("/api/room/test1/vote")
				.send(video)
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.success).toBe(false);
				});
		});

		it("should fail when invalid paramenters are given", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";

			await request(app)
				.delete("/api/room/test1/vote")
				.send({ service: "direct" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Invalid parameters");
				});
		});

		it("should fail with PermissionDeniedException", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";
			room.permissions[0] = 0;

			await request(app)
				.delete("/api/room/test1/vote")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(400)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual({
						name: "PermissionDeniedException",
						message: "Permission denied: manage-queue.vote",
					});
				});
		});

		it("should fail when something unexpected happens", async () => {
			await roommanager.createRoom("test1", true);

			let room = await roommanager.getOrLoadRoom("test1");
			room.queueMode = "vote";
			jest.spyOn(room, 'removeVoteVideo').mockImplementation(() => {
				throw new Error("fake unknown error");
			});

			await request(app)
				.delete("/api/room/test1/vote")
				.send({ service: "direct", id: "https://example.com/test.mp4" })
				.expect("Content-Type", /json/)
				.expect(500)
				.then(resp => {
					expect(resp.body.success).toBe(false);
					expect(resp.body.error).toEqual("Failed to get room");
				});
		});
	});
});

describe("Data API", () => {
	it("GET /data/previewAdd", async done => {
		let resolveQuerySpy = jest.spyOn(InfoExtract, "resolveVideoQuery").mockReturnValue(Promise.resolve([]));

		await request(app)
			.get("/api/data/previewAdd")
			.query({ input: "test search query" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body).toHaveLength(0);
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = jest.spyOn(InfoExtract, "resolveVideoQuery").mockImplementation(() => new Promise((resolve, reject) => reject({ name: "UnsupportedServiceException", message: "error message" })));

		await request(app)
			.get("/api/data/previewAdd")
			.query({ input: "test search query" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = jest.spyOn(InfoExtract, "resolveVideoQuery").mockImplementation(() => new Promise((resolve, reject) => reject({ name: "InvalidAddPreviewInputException", message: "error message" })));

		await request(app)
			.get("/api/data/previewAdd")
			.query({ input: "test search query" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = jest.spyOn(InfoExtract, "resolveVideoQuery").mockImplementation(() => new Promise((resolve, reject) => reject({ name: "OutOfQuotaException", message: "error message" })));

		await request(app)
			.get("/api/data/previewAdd")
			.query({ input: "test search query" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		done();
	});

	describe("GET /api/data/permissions", () => {
		it("should get available permissions and roles", async () => {
			await request(app)
				.get("/api/data/permissions")
				.expect("Content-Type", /json/)
				.expect(200)
				.then(resp => {
					expect(resp.body.roles).toHaveLength(6);
					expect(resp.body.permissions).toBeDefined();
				});
		});
	});
});

describe("Announcements API", () => {
	beforeAll(() => {
		process.env.OPENTOGETHERTUBE_API_KEY = TEST_API_KEY;
	});

	it("should send an announcement", async () => {
		let sendAnnouncementSpy = jest.spyOn(roommanager, "sendAnnouncement").mockImplementation(() => {});

		await request(app)
			.post("/api/announce")
			.send({ apikey: TEST_API_KEY, text: "test announcement" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body).toEqual({
					success: true,
				});
			});
		expect(sendAnnouncementSpy).toHaveBeenCalledWith("test announcement");

		sendAnnouncementSpy.mockRestore();
	});

	it("should not send announcement if the api key does not match", async () => {
		let sendAnnouncementSpy = jest.spyOn(roommanager, "sendAnnouncement").mockImplementation(() => {});

		await request(app)
			.post("/api/announce")
			.send({ text: "test announcement" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: "apikey was not supplied",
				});
			});
		expect(sendAnnouncementSpy).not.toHaveBeenCalled();

		sendAnnouncementSpy.mockReset();

		await request(app)
			.post("/api/announce")
			.send({ apikey: "wrong key", text: "test announcement" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: "apikey is invalid",
				});
			});
		expect(sendAnnouncementSpy).not.toHaveBeenCalled();

		sendAnnouncementSpy.mockRestore();
	});

	it("should not send an announcement if no text is provided", async () => {
		let sendAnnouncementSpy = jest.spyOn(roommanager, "sendAnnouncement").mockImplementation(() => {});

		await request(app)
			.post("/api/announce")
			.send({ apikey: TEST_API_KEY })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: "text was not supplied",
				});
			});
		expect(sendAnnouncementSpy).not.toHaveBeenCalled();

		sendAnnouncementSpy.mockRestore();
	});

	it("should fail if an unknown error occurrs", async () => {
		let sendAnnouncementSpy = jest.spyOn(roommanager, "sendAnnouncement").mockImplementation(() => {
			throw new Error("fake error");
		});

		await request(app)
			.post("/api/announce")
			.send({ apikey: TEST_API_KEY, text: "test announcement" })
			.expect("Content-Type", /json/)
			.expect(500)
			.then(resp => {
				expect(resp.body).toEqual({
					success: false,
					error: "Unknown, check logs",
				});
			});
		expect(sendAnnouncementSpy).toHaveBeenCalledWith("test announcement");

		sendAnnouncementSpy.mockRestore();
	});
});
