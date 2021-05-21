import { QueueMode, Visibility } from "./room";
import { Grants } from "./permissions"
import Video from "../common/video";

export type ServerMessage = ServerMessageSync | ServerMessageUnload

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

export interface ServerMessageUnload extends ServerMessageBase {
	action: "unload"
}

export type ClientMessage = ClientMessagePlay | ClientMessagePause | ClientMessageSkip | ClientMessageSeek | ClientMessageOrder;

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

export interface ClientMessageOrder extends ClientMessageBase {
	action: "queue-move"
	currentIdx: number
	targetIdx: number
}

export type RoomRequest = PlaybackRequest | SkipRequest | SeekRequest | AddRequest| RemoveRequest| OrderRequest| VoteRequest| PromoteRequest| DemoteRequest

interface RoomRequestBase {
	permission: string
}

export interface PlaybackRequest extends RoomRequestBase {
	permission: "playback.play-pause"
	state: boolean
}

export interface SkipRequest extends RoomRequestBase {
	permission: "playback.skip"
}

export interface SeekRequest extends RoomRequestBase {
	permission: "playback.seek"
	value: number
}

export interface AddRequest extends RoomRequestBase {
	permission: "manage-queue.add"
	video?: Video
	videos?: Video[]
	url? :string
}

export interface RemoveRequest extends RoomRequestBase {
	permission: "manage-queue.remove"
	video: Video
}

export interface OrderRequest extends RoomRequestBase {
	permission: "manage-queue.order"
	fromIdx: number
	toIdx: number
}

export interface VoteRequest extends RoomRequestBase {
	permission: "manage-queue.vote"
}

export interface PromoteRequest extends RoomRequestBase {
	permission: "manage-users.promote-admin" | "manage-users.promote-moderator" | "manage-users.promote-trusted-user"
}

export interface DemoteRequest extends RoomRequestBase {
	permission: "manage-users.demote-admin" | "manage-users.demote-moderator" | "manage-users.demote-trusted-user"
}
