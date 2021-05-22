import { Session } from "express-session";
import Video from "../common/video";
import { Grants } from "./permissions.js";

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

export type MySession = Session & { username?: string, passport?: { user?: number } }

export type ClientInfo = { id: string, username?: string, user_id?: number }

export interface RoomOptions {
	name: string
	title: string
	description: string
	visibility: Visibility
	queueMode: QueueMode
	isTemporary: boolean
}

export interface RoomState extends RoomOptions {
	currentSource: Video | null
	queue: Video[]
	isPlaying: boolean
	playbackPosition: number
	grants: Grants
	users: RoomUserInfo[]
}

export type RoomUserInfo = {
	name: string
	isLoggedIn: boolean
	status: any // TODO: make this an enum
	role: Role
}

export enum Role {
	Administrator = 4,
	Moderator = 3,
	TrustedUser = 2,
	RegisteredUser = 1,
	UnregisteredUser = 0,
	Owner = -1,
};
