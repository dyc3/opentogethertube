import type { Monolith, Room, SystemState } from "ott-vis";

/**
 * Builds a map of room names to the number of clients in each room from the room state.
 * @param state
 */
export function countRoomClients(state: SystemState): Record<string, number> {
	const roomClients: Record<string, number> = {};
	for (const balancer of state) {
		for (const monolith of balancer.monoliths) {
			for (const room of monolith.rooms) {
				roomClients[room.name] = (roomClients[room.name] ?? 0) + room.clients;
			}
		}
	}
	return roomClients;
}

/**
 * Collect a map of monolith ids to room names.
 * @param state
 * @returns
 */
export function aggMonolithRooms(state: SystemState): Record<string, string[]> {
	const roomClients: Record<string, Set<string>> = {};
	for (const balancer of state) {
		for (const monolith of balancer.monoliths) {
			const s = roomClients[monolith.id] ?? new Set();
			roomClients[monolith.id] = s;
			for (const room of monolith.rooms) {
				s.add(room.name);
			}
		}
	}
	return Object.fromEntries(Object.entries(roomClients).map(([k, v]) => [k, Array.from(v)]));
}

export function groupMonolithsByRegion(state: SystemState): Record<string, string[]> {
	const regionMonoliths: Record<string, Set<string>> = {};
	for (const balancer of state) {
		for (const monolith of balancer.monoliths) {
			const s = regionMonoliths[monolith.region] ?? new Set();
			s.add(monolith.id);
			regionMonoliths[monolith.region] = s;
		}
	}
	return Object.fromEntries(Object.entries(regionMonoliths).map(([k, v]) => [k, Array.from(v)]));
}

/**
 * Reduces two room states into a single room state.
 * @param rA
 * @param rB
 * @returns
 */
function reduceRoom(rA: Room, rB: Room): Room {
	if (rA.name !== rB.name) {
		throw new Error("Cannot reduce rooms with different names");
	}
	return {
		name: rA.name,
		clients: rA.clients + rB.clients,
	};
}

function reduceMonolith(mA: Monolith, mB: Monolith): Monolith {
	if (mA.id !== mB.id) {
		throw new Error("Cannot reduce monoliths with different ids");
	}
	return {
		id: mA.id,
		region: mA.region,
		rooms: dedupeRooms([...mA.rooms, ...mB.rooms]),
	};
}

export function dedupeItems<T>(
	items: T[],
	getKey: (item: T) => string,
	reduce: (a: T, b: T) => T
): T[] {
	const itemMap = new Map<string, T>();
	for (const item of items) {
		const key = getKey(item);
		let existingItem = itemMap.get(key);
		if (!existingItem) {
			existingItem = item;
			itemMap.set(key, existingItem);
			continue;
		}
		itemMap.set(key, reduce(existingItem, item));
	}
	return Array.from(itemMap.values());
}

/**
 * Takes a list of rooms and produces a new list of rooms such that each room only appears once.
 * @param rooms List of all rooms across all balancers
 */
export function dedupeRooms(rooms: Room[]): Room[] {
	return dedupeItems(rooms, room => room.name, reduceRoom);
}

export function dedupeMonoliths(monoliths: Monolith[]): Monolith[] {
	return dedupeItems(monoliths, monolith => monolith.id, reduceMonolith);
}
