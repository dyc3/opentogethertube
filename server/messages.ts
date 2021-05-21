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

export type RoomRequest = JoinRequest | LeaveRequest | PlaybackRequest | SkipRequest | SeekRequest | AddRequest | RemoveRequest | OrderRequest | VoteRequest | PromoteRequest | DemoteRequest

export enum RoomRequestType {
	JoinRequest,
	LeaveRequest,
	PlaybackRequest,
	SkipRequest,
	SeekRequest,
	AddRequest,
	RemoveRequest,
	OrderRequest,
	VoteRequest,
	PromoteRequest,
	DemoteRequest,
}

interface RoomRequestBase {
	type: RoomRequestType
	permission: string
}

export interface JoinRequest {
	type: RoomRequestType.JoinRequest
	id: string
	user_id?: number
	username: string
}

export interface LeaveRequest {
	type: RoomRequestType.LeaveRequest
	id: string
}

export interface PlaybackRequest extends RoomRequestBase {
	type: RoomRequestType.PlaybackRequest
	permission: "playback.play-pause"
	state: boolean
}

export interface SkipRequest extends RoomRequestBase {
	type: RoomRequestType.SkipRequest
	permission: "playback.skip"
}

export interface SeekRequest extends RoomRequestBase {
	type: RoomRequestType.SeekRequest
	permission: "playback.seek"
	value: number
}

export interface AddRequest extends RoomRequestBase {
	type: RoomRequestType.AddRequest
	permission: "manage-queue.add"
	video?: Video
	videos?: Video[]
	url? :string
}

export interface RemoveRequest extends RoomRequestBase {
	type: RoomRequestType.RemoveRequest
	permission: "manage-queue.remove"
	video: Video
}

export interface OrderRequest extends RoomRequestBase {
	type: RoomRequestType.OrderRequest
	permission: "manage-queue.order"
	fromIdx: number
	toIdx: number
}

export interface VoteRequest extends RoomRequestBase {
	type: RoomRequestType.VoteRequest
	permission: "manage-queue.vote"
}

export interface PromoteRequest extends RoomRequestBase {
	type: RoomRequestType.PromoteRequest
	permission: "manage-users.promote-admin" | "manage-users.promote-moderator" | "manage-users.promote-trusted-user"
}

export interface DemoteRequest extends RoomRequestBase {
	type: RoomRequestType.DemoteRequest
	permission: "manage-users.demote-admin" | "manage-users.demote-moderator" | "manage-users.demote-trusted-user"
}
