import { Session } from "express-session";
import { Video } from "./video";
import { Grants } from "../permissions";
import type { Segment } from "sponsorblock-api";

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
	MISSING_TOKEN = 4004,
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
	autoSkipSegments: boolean
}

/**
 * Things that can be used in `Room`'s constructor. These must be remembered.
 */
export interface RoomOptions extends RoomSettings {
	name: string
	isTemporary: boolean
	owner: UserAccountAttributes | null
	userRoles: Map<Role, Set<number>>
}

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

export interface RoomEventContext {
	video?: Video
	videos?: Video[]
	prevPosition?: number
	queueIdx?: number
	user?: RoomUserInfo
}

export interface ChatMessage {
	from: RoomUserInfo
	text: string
}

export interface UserAccountAttributes {
	id: number;
	username: string;
	email: string | null;
	salt: Buffer | null;
	hash: Buffer | null;
	discordId: string | null;
}
