import type { Request } from "express";
import { OttWebsocketError } from "ott-common/models/types.js";
import { ok, Result } from "ott-common/result.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BalancerConnection,
	BalancerConnectionEventHandlers,
	BalancerConnectionEvents,
	BalancerConnectionReal,
	balancerManager,
	MsgM2B,
} from "../../balancer.js";
import { BalancerClient, Client } from "../../client.js";
import clientmanager, {
	parseWebsocketConnectionUrl,
	setupBalancerManager,
} from "../../clientmanager.js";
import { type M2BInit, type MsgB2M, UnloadReason } from "../../generated.js";
import { loadModels } from "../../models/index.js";
import { conf, loadConfigFile } from "../../ott-config.js";
import { buildClients } from "../../redisclient.js";
import roommanager from "../../roommanager.js";

class TestClient extends Client {
	sendRawMock = vi.fn();
	kickMock = vi.fn();

	get clientType() {
		return "test";
	}

	sendRaw(msg: string): void {
		this.sendRawMock(msg);
	}

	kick(code: OttWebsocketError): void {
		this.kickMock(code);
		this.emit("disconnect", this);
	}
}

class BalancerConnectionMock extends BalancerConnection {
	sendMock = vi.fn<[MsgM2B], void>();
	disconnectMock = vi.fn<[], void>();

	constructor() {
		super();
	}

	send(msg: MsgM2B): Result<void, Error> {
		this.sendMock(msg);
		return ok(undefined);
	}

	disconnect(): Result<void, Error> {
		this.disconnectMock();
		return ok(undefined);
	}

	async emitInit() {
		const init: MsgB2M = {
			type: "init",
			payload: {
				id: this.id,
			},
		};
		this.emit("message", init);
	}

	public emit<E extends BalancerConnectionEvents>(
		event: E,
		...args: Parameters<BalancerConnectionEventHandlers<E>>
	) {
		super.emit(event, ...args);
	}
}

describe("ClientManager", () => {
	beforeAll(async () => {
		loadConfigFile();
		loadModels();
		await buildClients();
		await clientmanager.setup();
	});

	beforeEach(async () => {
		await roommanager.createRoom({
			name: "foo",
			isTemporary: true,
		});
	});

	afterEach(async () => {
		await roommanager.unloadRoom("foo", UnloadReason.Admin);
	});

	it.each([
		["/api/room/foo", "foo"],
		["/api/room/foo/", "foo"],
		["/api/room/foo/bar", "foo"],
		["/api/room/foo?reconnect=true", "foo"],
	])(`should parse room name from %s`, (path, roomName) => {
		const got = parseWebsocketConnectionUrl({ url: path, headers: {} } as Request);
		expect(got).toEqual(roomName);
	});

	it.each([
		["/base", "/api/room/foo", "foo"],
		["/base", "/api/room/foo/", "foo"],
		["/base", "/api/room/foo/bar", "foo"],
		["/base", "/api/room/foo?reconnect=true", "foo"],
		["/base/base2", "/api/room/foo", "foo"],
		["/base/base2", "/api/room/foo/", "foo"],
		["/base/base2", "/api/room/foo/bar", "foo"],
		["/base/base2", "/api/room/foo?reconnect=true", "foo"],
	])(`should parse room name when base url is %s from %s`, (baseurl, path, roomName) => {
		conf.set("base_url", baseurl);
		const got = parseWebsocketConnectionUrl({ url: baseurl + path, headers: {} } as Request);
		expect(got).toEqual(roomName);
		conf.set("base_url", "/");
	});

	it("should add clients", () => {
		const client = new TestClient("foo");
		clientmanager.addClient(client);
		expect(clientmanager.getClient(client.id)).toBe(client);
	});

	it("should add clients to roomJoins when they auth", async () => {
		const client = new TestClient("foo");
		clientmanager.addClient(client);
		client.emit("auth", client, "token", { isLoggedIn: false, username: "foo" });
		await new Promise(resolve => setTimeout(resolve, 100));
		const joins = clientmanager.getClientsInRoom("foo");
		expect(joins).toHaveLength(1);
	});

	it("should remove clients when they disconnect", () => {
		const client = new TestClient("foo");
		clientmanager.addClient(client);
		client.emit("disconnect", client);
		expect(clientmanager.getClient(client.id)).toBeUndefined();
	});

	it("should remove clients from roomJoins when they disconnect", async () => {
		const client = new TestClient("foo");
		clientmanager.addClient(client);
		client.emit("auth", client, "token", { isLoggedIn: false, username: "foo" });
		await new Promise(resolve => setTimeout(resolve, 100));
		const joins = clientmanager.getClientsInRoom("foo");
		expect(joins).toHaveLength(1);

		client.emit("disconnect", client);
		const joins2 = clientmanager.getClientsInRoom("foo");
		expect(joins2).toHaveLength(0);
	});

	it("should disconnect all clients when a balancer disconnects", async () => {
		const mockBalancerCon = new BalancerConnectionMock();
		balancerManager.addBalancerConnection(mockBalancerCon);
		await mockBalancerCon.emitInit();
		const client = new BalancerClient("foo", "foo", mockBalancerCon);
		clientmanager.addClient(client);
		client.emit("auth", client, "token", { isLoggedIn: false, username: "foo" });
		await new Promise(resolve => setTimeout(resolve, 100));
		const joins = clientmanager.getClientsInRoom("foo");
		expect(joins).toHaveLength(1);

		mockBalancerCon.emit("disconnect", 1000, "reason");

		expect(clientmanager.getClient(client.id)).toBeUndefined();
		const joins2 = clientmanager.getClientsInRoom("foo");
		expect(joins2).toHaveLength(0);
	});

	it("should disconnect only clients that were from the balancer when a balancer disconnects", async () => {
		const mockBalancerCon = new BalancerConnectionMock();
		const mockBalancerCon2 = new BalancerConnectionMock();
		balancerManager.addBalancerConnection(mockBalancerCon);
		await mockBalancerCon.emitInit();
		balancerManager.addBalancerConnection(mockBalancerCon2);
		await mockBalancerCon2.emitInit();
		const client1 = new BalancerClient("foo", "foo1", mockBalancerCon);
		const client2 = new BalancerClient("foo", "foo2", mockBalancerCon);
		const client3 = new TestClient("foo");
		const client4 = new BalancerClient("foo", "bar", mockBalancerCon2);
		const client5 = new BalancerClient("foo", "foo2", mockBalancerCon);
		const clients = [client1, client2, client3, client4, client5];
		for (let [i, client] of clients.entries()) {
			clientmanager.addClient(client);
			client.emit("auth", client, "token" + i, { isLoggedIn: false, username: "foo" + i });
		}
		await new Promise(resolve => setTimeout(resolve, 100));
		const joins = clientmanager.getClientsInRoom("foo");
		expect(joins).toHaveLength(5);

		mockBalancerCon.emit("disconnect", 1000, "reason");

		expect(clientmanager.getClient(client1.id)).toBeUndefined();
		expect(clientmanager.getClient(client2.id)).toBeUndefined();
		expect(clientmanager.getClient(client3.id)).toBeDefined();
		expect(clientmanager.getClient(client4.id)).toBeDefined();
		expect(clientmanager.getClient(client5.id)).toBeUndefined();

		const joins2 = clientmanager.getClientsInRoom("foo");
		expect(joins2).toHaveLength(2);
	});
});

describe("BalancerManager", () => {
	beforeEach(() => {
		balancerManager.balancerConnections.splice(0, balancerManager.balancerConnections.length);
		setupBalancerManager();
	});

	afterEach(() => {
		balancerManager.clearListeners();
	});

	it("should remove the correct balancer from the list when it disconnects", async () => {
		const con1 = new BalancerConnectionMock();
		const con2 = new BalancerConnectionMock();
		const con3 = new BalancerConnectionMock();

		balancerManager.addBalancerConnection(con1);
		await con1.emitInit();
		balancerManager.addBalancerConnection(con2);
		await con2.emitInit();
		balancerManager.addBalancerConnection(con3);
		await con3.emitInit();

		expect(balancerManager.balancerConnections).toHaveLength(3);

		con2.emit("disconnect", 1000, "reason");

		expect(balancerManager.balancerConnections).toHaveLength(2);
		expect(balancerManager.balancerConnections).not.toContain(con2);
	});

	it("should not add balancers before they send the init message", async () => {
		const con1 = new BalancerConnectionMock();

		balancerManager.addBalancerConnection(con1);
		expect(balancerManager.balancerConnections).toHaveLength(0);
		await con1.emitInit();
		expect(balancerManager.balancerConnections).toHaveLength(1);
	});

	it("should send the same ID to each connection", () => {
		const mock1 = new BalancerConnectionMock();
		const mock2 = new BalancerConnectionMock();

		balancerManager.addBalancerConnection(mock1);
		balancerManager.addBalancerConnection(mock2);

		const id1 = (mock1.sendMock.mock.calls[0][0].payload as M2BInit).id;
		const id2 = (mock2.sendMock.mock.calls[0][0].payload as M2BInit).id;

		expect(id1).toBeDefined();
		expect(id2).toBeDefined();
		expect(id1).toEqual(id2);
	});

	it("should unload rooms when a balancer tells it to", async () => {
		const mock = new BalancerConnectionMock();
		await Promise.all([balancerManager.addBalancerConnection(mock), mock.emitInit()]);

		await roommanager.createRoom({
			name: "foo",
			isTemporary: true,
		});
		expect((await roommanager.getRoom("foo", { mustAlreadyBeLoaded: true })).ok).toEqual(true);
		mock.emit("message", {
			type: "unload",
			payload: {
				room: "foo",
			},
		});
		await new Promise(resolve => setTimeout(resolve, 100));
		expect((await roommanager.getRoom("foo", { mustAlreadyBeLoaded: true })).ok).toEqual(false);
	});
});
