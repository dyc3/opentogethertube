import type { SystemState } from "ott-vis-common";

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
