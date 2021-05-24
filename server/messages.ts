import { Grants } from "./permissions";
import { ClientId, ClientInfo, QueueMode, RoomUserInfo, Visibility } from "./types";
import { VideoId } from "../common/models/video";

export type ServerMessage = ServerMessageSync | ServerMessageUnload | ServerMessageChat

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

export interface ServerMessageChat extends ServerMessageBase {
	action: "chat"
	from: RoomUserInfo
	text: string
}

export type ClientMessage = ClientMessagePlay | ClientMessagePause | ClientMessageSkip | ClientMessageSeek | ClientMessageOrder | ClientMessageChat | ClientMessageKickMe;

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

export interface ClientMessageChat extends ClientMessageBase {
	action: "chat"
	text: string
}

export interface ClientMessageKickMe extends ClientMessageBase {
	action: "kickme"
}

export type RoomRequest = JoinRequest | LeaveRequest | PlaybackRequest | SkipRequest | SeekRequest | AddRequest | RemoveRequest | OrderRequest | VoteRequest | PromoteRequest | DemoteRequest | UpdateUser | ChatRequest

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
	UpdateUser,
	ChatRequest,
}

interface RoomRequestBase {
	type: RoomRequestType
	client: ClientId
}

export interface JoinRequest extends RoomRequestBase {
	type: RoomRequestType.JoinRequest
	info: ClientInfo
}

export interface LeaveRequest extends RoomRequestBase {
	type: RoomRequestType.LeaveRequest
}

export interface PlaybackRequest extends RoomRequestBase {
	type: RoomRequestType.PlaybackRequest
	state: boolean
}

export interface SkipRequest extends RoomRequestBase {
	type: RoomRequestType.SkipRequest
}

export interface SeekRequest extends RoomRequestBase {
	type: RoomRequestType.SeekRequest
	value: number
}

export interface AddRequest extends RoomRequestBase {
	type: RoomRequestType.AddRequest
	video?: VideoId
	videos?: VideoId[]
	url? :string
}

export interface RemoveRequest extends RoomRequestBase {
	type: RoomRequestType.RemoveRequest
	video: VideoId
}

export interface OrderRequest extends RoomRequestBase {
	type: RoomRequestType.OrderRequest
	fromIdx: number
	toIdx: number
}

export interface VoteRequest extends RoomRequestBase {
	type: RoomRequestType.VoteRequest
}

export interface PromoteRequest extends RoomRequestBase {
	type: RoomRequestType.PromoteRequest
	permission: "manage-users.promote-admin" | "manage-users.promote-moderator" | "manage-users.promote-trusted-user"
}

export interface DemoteRequest extends RoomRequestBase {
	type: RoomRequestType.DemoteRequest
	permission: "manage-users.demote-admin" | "manage-users.demote-moderator" | "manage-users.demote-trusted-user"
}

/**
 * Request that the room pull new information about the user.
 */
export interface UpdateUser extends RoomRequestBase {
	type: RoomRequestType.UpdateUser
	info: ClientInfo
}

export interface ChatRequest extends RoomRequestBase {
	type: RoomRequestType.ChatRequest
	text: string
}
