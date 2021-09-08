import { Session } from "express-session";
import { User } from "models/user";
import { Video } from "./video";
import { Grants } from "../permissions";

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
	MISSING_AUTH = 4004,
}

export enum PlayerStatus {
	none = "none",
	ready = "ready",
	buffering = "buffering",
	error = "error",
}

export type AuthToken = string
export type MySession = Session & { username?: string, passport?: { user?: number }, token?: string }

export type ClientInfo = { id: ClientId, username?: string, user_id?: number, status?: PlayerStatus }

/**
 * Settings that can be set through the "settings" UI.
 */
export interface RoomSettings {
	title: string
	description: string
	visibility: Visibility
	queueMode: QueueMode
	grants: Grants
}

/**
 * Things that can be used in `Room`'s constructor. These must be remembered.
 */
export interface RoomOptions extends RoomSettings {
	name: string
	isTemporary: boolean
	owner: User | null
	userRoles: Map<Role, Set<number>>
}

/**
 * Things that Rooms need to remember, but can safely be forgotten when the room is unloaded.
 * This rule does not necessarily apply to inherited fields.
 */
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
export type RoomStateSyncable = Omit<RoomState, "owner" | "votes" | "userRoles" | "grants">

// Only these should be stored in redis
export type RoomStateStorable = Omit<RoomState, "hasOwner" | "votes" | "voteCounts" | "users">

// Only these should be stored in persistent storage
export type RoomStatePersistable = Omit<RoomState, "currentSource" | "queue" | "isPlaying" | "playbackPosition">

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

export type RoomEventContext = {
	video: Video
} | {
	videos: Video[]
} | {
	video: Video,
	prevPosition: number,
} | {
	value: number,
	prevPosition: number,
} | {
	queueIdx?: number
} | {
	user: RoomUserInfo
} | {
	state: boolean
} | {}
