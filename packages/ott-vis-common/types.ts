/**
 * Describes the state of OTT
 */
export type SystemState = Balancer[];

export interface Balancer {
	id: string;
	region: string;
	monoliths: Monolith[];
}

export interface Monolith {
	id: string;
	region: string;
	rooms: Room[];
}

export interface Room {
	name: string;
	clients: number;
}
