/* eslint-disable no-unused-vars */
import { Session } from "express-session";
import { User } from "models/user";
// import { Grants } from "../../server/permissions.js";
import { Video } from "./video";

export enum Visibility {
	Public = "public",
	Unlisted = "unlisted",
	Private = "private",
}

export enum QueueMode {
	Manual = "manual",
	Vote = "vote",
	Loop = "loop",
	Dj = "dj",
}

export enum OttWebsocketError {
	UNKNOWN = 4000,
	INVALID_CONNECTION_URL = 4001,
	ROOM_NOT_FOUND = 4002,
	ROOM_UNLOADED = 4003,
}

export enum PlayerStatus {
	none = "none",
	ready = "ready",
	buffering = "buffering",
	error = "error",
}

export type MySession = Session & { username?: string, passport?: { user?: number } }

export type ClientInfo = { id: ClientId, username?: string, user_id?: number, status?: PlayerStatus }

export interface RoomOptions {
	name: string
	title: string
	description: string
	visibility: Visibility
	queueMode: QueueMode
	isTemporary: boolean
	owner: User | null,
	grants: Grants
	userRoles: Map<Role, Set<number>>
}

export interface RoomState extends RoomOptions, RoomStateComputed {
	currentSource: Video | null
	queue: Video[]
	isPlaying: boolean
	playbackPosition: number
	users: RoomUserInfo[]
	votes: Map<string, Set<ClientId>>
}

export interface RoomStateComputed {
	hasOwner: boolean
	voteCounts: Map<string, number>
}

// Only these should be sent to clients, all others should be considered unsafe
export type RoomStateSyncable = Omit<RoomState, "owner" | "votes" | "userRoles">

export type RoomUserInfo = {
	id: ClientId
	name: string
	isLoggedIn: boolean
	status: PlayerStatus
	role: Role
}

export enum Role {
	Administrator = 4,
	Moderator = 3,
	TrustedUser = 2,
	RegisteredUser = 1,
	UnregisteredUser = 0,
	Owner = -1,
}

export type ClientId = string

export declare class Grants {
	masks: any
	constructor(grants?: Grants | any);
}

export interface RoomEventContext {
	video?: Video
	videos?: Video[]
	prevPosition?: number
	queueIdx?: number
	user?: RoomUserInfo
}
