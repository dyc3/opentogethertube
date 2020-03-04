const request = require('supertest');
const app = require('../../../app.js').app;
const roommanager = require('../../../roommanager.js');

describe("Room API", () => {
	it("GET /room/list", async done => {
		await request(app)
			.get("/api/room/list")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body).toHaveLength(0);
			});

		roommanager.createRoom("test1", true);
		roommanager.createRoom("test2", true);

		await request(app)
			.get("/api/room/list")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body).toHaveLength(2);
				expect(resp.body[0]).toEqual({
					name: "test1",
					description: "",
					isTemporary: true,
					currentSource: {},
					users: 0,
				});
				expect(resp.body[1]).toEqual({
					name: "test2",
					description: "",
					isTemporary: true,
					currentSource: {},
					users: 0,
				});
			});

		roommanager.unloadRoom("test1", true);
		roommanager.unloadRoom("test2", true);

		roommanager.createRoom("test1", true, "public");
		roommanager.createRoom("test2", true, "unlisted");
		roommanager.createRoom("test3", true, "private");

		await request(app)
			.get("/api/room/list")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body).toHaveLength(1);
				expect(resp.body[0]).toEqual({
					name: "test1",
					description: "",
					isTemporary: true,
					currentSource: {},
					users: 0,
				});
			});

		roommanager.unloadRoom("test1", true);
		roommanager.unloadRoom("test2", true);
		roommanager.unloadRoom("test3", true);

		done();
	});

	it("GET /room/:name", async done => {
		roommanager.createRoom("test1", true);

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

		roommanager.unloadRoom("test1", true);

		roommanager.createRoom("test1", true, "unlisted");

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
				expect(resp.body.success).toBeTruthy();
				expect(roommanager.rooms[0].name).toBe("test1");
				expect(roommanager.rooms[0].isTemporary).toBeTruthy();
				expect(roommanager.rooms[0].visibility).toBe("public");
			});

		roommanager.unloadRoom("test1", true);

		await request(app)
			.post("/api/room/create")
			.send({ name: "test1", temporary: true, visibility: "unlisted" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
				expect(roommanager.rooms[0].name).toBe("test1");
				expect(roommanager.rooms[0].isTemporary).toBeTruthy();
				expect(roommanager.rooms[0].visibility).toBe("unlisted");
			});

		roommanager.unloadRoom("test1", true);

		await request(app)
			.post("/api/room/create")
			.send({ name: "test1", temporary: true, visibility: "invalid" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
			});

		await request(app)
			.post("/api/room/create")
			.send({ temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
				expect(resp.body.error).toContain("Missing argument");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "a", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
				expect(resp.body.error).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "list", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
				expect(resp.body.error).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "create", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
				expect(resp.body.error).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "generate", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
				expect(resp.body.error).toContain("not allowed");
			});

		await request(app)
			.post("/api/room/create")
			.send({ name: "?><>J", temporary: true })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
				expect(resp.body.error).toContain("not allowed");
			});

		done();
	});

	it("POST /room/generate", done => {
		request(app)
			.post("/api/room/generate")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
				expect(resp.body.room).toBeDefined();
				done();
			});
	});

	it("PATCH /room/:name", async done => {
		roommanager.createRoom("test1", true);

		await request(app)
			.patch("/api/room/test1")
			.send({ title: "Test" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
			});

		roommanager.unloadRoom("test1", true);

		roommanager.createRoom("test1", true);

		await request(app)
			.patch("/api/room/test1")
			.send({ visibility: "unlisted" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
			});
		await request(app)
			.patch("/api/room/test1")
			.send({ visibility: "invalid" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
			});

		roommanager.unloadRoom("test1", true);

		roommanager.createRoom("test1", true);

		await request(app)
			.patch("/api/room/test1")
			.send({ queueMode: "vote" })
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
			});
		await request(app)
			.patch("/api/room/test1")
			.send({ queueMode: "invalid" })
			.expect("Content-Type", /json/)
			.expect(400)
			.then(resp => {
				expect(resp.body.success).toBeFalsy();
			});

		roommanager.unloadRoom("test1", true);

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

		done();
	});

	it("DELETE /room/:name", async done => {
		roommanager.createRoom("test1", true);

		await request(app)
			.delete("/api/room/test1")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.success).toBeTruthy();
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
});

describe("User API", () => {
	it("GET /user", done => {
		request(app)
			.get("/api/user")
			.expect("Content-Type", /json/)
			.expect(200)
			.then(resp => {
				expect(resp.body.name).toBeDefined();
				done();
			});
	});
});
