/*
 Generated by typeshare 1.7.0
*/

export type ClientId = string;

export type RoomName = string;

export type MonolithId = string;

export interface B2MLoad {
	room: RoomName;
}

export interface B2MJoin {
	room: RoomName;
	client: ClientId;
	token: string;
}

export interface B2MLeave {
	client: ClientId;
}

export interface B2MClientMsg<T = unknown> {
	/** The client that sent the message. */
	client_id: ClientId;
	/** The message that was received from the client, verbatim. */
	payload: T;
}

export interface M2BInit {
	/** The port that the monolith is listening for HTTP requests on. */
	port: number;
}

export enum Visibility {
	Public = "public",
	Unlisted = "unlisted",
	Private = "private",
}

/** Metadata about a room, according to the Monolith. */
export interface RoomMetadata {
	name: RoomName;
	title: string;
	description: string;
	isTemporary: boolean;
	visibility: Visibility;
	queueMode: string;
	currentSource: unknown;
	/** The number of clients in this room. */
	users: number;
}

export interface M2BLoaded {
	room: RoomMetadata;
	/** A system-global epoch that is incremented every time a room is loaded or unloaded on any monolith. Used to determine which instance of a room is the oldest. */
	load_epoch: number;
}

export interface M2BUnloaded {
	name: RoomName;
}

export interface GossipRoom {
	room: RoomMetadata;
	load_epoch: number;
}

export interface M2BGossip {
	rooms: GossipRoom[];
}

export interface M2BRoomMsg<T = unknown> {
	/** The room to send the message to. */
	room: RoomName;
	/** The client to send the message to. If `None`, send to all clients in the room. */
	client_id?: ClientId;
	/** The message to send, verbatim. */
	payload: T;
}

export interface M2BKick {
	client_id: ClientId;
	reason: number;
}

export type MsgB2M = 
	| { type: "load", payload: B2MLoad }
	| { type: "join", payload: B2MJoin }
	| { type: "leave", payload: B2MLeave }
	| { type: "client_msg", payload: B2MClientMsg };

export type MsgM2B = 
	| { type: "init", payload: M2BInit }
	| { type: "loaded", payload: M2BLoaded }
	| { type: "unloaded", payload: M2BUnloaded }
	| { type: "gossip", payload: M2BGossip }
	| { type: "room_msg", payload: M2BRoomMsg }
	| { type: "kick", payload: M2BKick };

