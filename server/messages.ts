import { QueueMode, Visibility } from "./room";
import { Grants } from "./permissions"

export type ServerMessage = ServerMessageSync

interface ServerMessageBase {
	action: string
}

export interface ServerMessageSync extends ServerMessageBase {
	action: "sync"
	name?: string
	title?: string,
	description?: string,
	isTemporary?: boolean,
	visibility?: Visibility,
	queueMode?: QueueMode,
	isPlaying?: boolean,
	playbackPosition?: number,
	grants?: number | Grants, // FIXME: permissions
}

export type ClientMessage = ClientMessagePlay | ClientMessagePause | ClientMessageSkip | ClientMessageSeek;

interface ClientMessageBase {
	action: string
}

export interface ClientMessagePlay extends ClientMessageBase {
	action: "play"
}

export interface ClientMessagePause extends ClientMessageBase {
	action: "pause"
}

export interface ClientMessageSkip extends ClientMessageBase {
	action: "skip"
}

export interface ClientMessageSeek extends ClientMessageBase {
	action: "seek"
	position: number
}

export type RoomRequest = PlaybackRequest | SkipRequest | SeekRequest

export interface PlaybackRequest {
	permission: "playback.play-pause"
	state: boolean
}

export interface SkipRequest {
	permission: "playback.skip"
}

export interface SeekRequest {
	permission: "playback.seek"
	value: number
}

