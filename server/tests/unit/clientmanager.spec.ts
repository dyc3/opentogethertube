import clientmanager from "../../clientmanager";
import {
	BalancerConnection,
	BalancerConnectionEventHandlers,
	BalancerConnectionEvents,
	BalancerConnectionReal,
	MsgM2B,
	balancerManager,
} from "../../balancer";
import { BalancerClient, Client } from "../../client";
import { OttWebsocketError } from "common/models/types";
import { buildClients } from "../../redisclient";
import { Result, ok } from "../../../common/result";
import roommanager from "../../roommanager";
import { loadModels } from "../../models";

class TestClient extends Client {
	sendRawMock = jest.fn();
	kickMock = jest.fn();

	sendRaw(msg: string): void {
		this.sendRawMock(msg);
	}

	kick(code: OttWebsocketError): void {
		this.kickMock(code);
		this.emit("disconnect", this);
	}
}

class BalancerConnectionMock extends BalancerConnection {
	sendMock = jest.fn();

	constructor() {
		super();
	}

	send(msg: MsgM2B): Result<void, Error> {
		this.sendMock(msg);
		return ok(undefined);
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
		await roommanager.unloadRoom("foo");
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
		balancerManager.addBalancerConnection(mockBalancerCon2);
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
	});

	it("should remove the correct balancer from the list when it disconnects", () => {
		const con1 = new BalancerConnectionMock();
		const con2 = new BalancerConnectionMock();
		const con3 = new BalancerConnectionMock();

		balancerManager.addBalancerConnection(con1);
		balancerManager.addBalancerConnection(con2);
		balancerManager.addBalancerConnection(con3);

		expect(balancerManager.balancerConnections).toHaveLength(3);

		con2.emit("disconnect", 1000, "reason");

		expect(balancerManager.balancerConnections).toHaveLength(2);
		expect(balancerManager.balancerConnections).not.toContain(con2);
	});
});

describe("MonolithId", () => {
	it("should send the same ID to each connection", () => {
		const mock1 = new BalancerConnectionMock();
		const mock2 = new BalancerConnectionMock();

		balancerManager.addBalancerConnection(mock1);
		balancerManager.addBalancerConnection(mock2);

		const message: MsgM2B = {
			type: "init",
			payload: {
				port: 3000,
				region: "us-west",
				id: "1234",
			},
		};

		mock1.send(message);
		mock2.send(message);

		const id1 = mock1.sendMock.mock.calls[0][0].payload.id;
		const id2 = mock2.sendMock.mock.calls[0][0].payload.id;

		expect(id1).toEqual(id2);
	});
});
