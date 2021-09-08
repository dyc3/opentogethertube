import { ClientId, ClientInfo, QueueMode, RoomUserInfo, Visibility, PlayerStatus, Role, RoomEventContext, RoomSettings, AuthToken } from "./types";
import { Video, VideoId } from "./video";

export type ServerMessage = ServerMessageSync | ServerMessageUnload | ServerMessageChat | ServerMessageEvent | ServerMessageAnnouncement | ServerMessageUser

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
}

export interface ServerMessageUnload extends ServerMessageBase {
	action: "unload"
}

export interface ServerMessageChat extends ServerMessageBase {
	action: "chat"
	from: RoomUserInfo
	text: string
}

export interface ServerMessageEvent extends ServerMessageBase {
	action: "event"
	request: Omit<RoomRequest, "token">
	user: Pick<RoomUserInfo, "name" | "isLoggedIn">
	additional: RoomEventContext
}

// export type ServerMessageEvent = ServerMessageEventJoin | ServerMessageEventLeave | ServerMessageEventPlayback | ServerMessageEventSeek | ServerMessageEventSkip | ServerMessageEventAddVideo | ServerMessageEventRemoveVideo;

// interface ServerMessageEventBase extends ServerMessageBase {
// 	action: "event"
// 	requestType: RoomRequestType
// 	user: Pick<RoomUserInfo, "name" | "isLoggedIn">
// }

// interface ServerMessageEventJoin extends ServerMessageEventBase {
// 	requestType: RoomRequestType.JoinRequest
// 	additional: undefined
// }

// interface ServerMessageEventLeave extends ServerMessageEventBase {
// 	requestType: RoomRequestType.LeaveRequest
// 	additional: {
// 		user: Pick<RoomUserInfo, "name" | "isLoggedIn">
// 	}
// }

// interface ServerMessageEventPlayback extends ServerMessageEventBase {
// 	requestType: RoomRequestType.PlaybackRequest
// 	additional: {
// 		state: boolean
// 	}
// }

// interface ServerMessageEventSeek extends ServerMessageEventBase {
// 	requestType: RoomRequestType.SeekRequest
// 	additional: {
// 		value: number,
// 		prevPosition: number,
// 	}
// }

// interface ServerMessageEventSkip extends ServerMessageEventBase {
// 	requestType: RoomRequestType.SkipRequest
// 	additional: {
// 		video: Video,
// 	}
// }

// interface ServerMessageEventAddVideo extends ServerMessageEventBase {
// 	requestType: RoomRequestType.AddRequest
// 	additional: {
// 		video: Video,
// 	} | {
// 		videos: Video[],
// 	}
// }

// interface ServerMessageEventRemoveVideo extends ServerMessageEventBase {
// 	requestType: RoomRequestType.RemoveRequest
// 	additional: {
// 		video: Video,
// 	}
// }

export interface ServerMessageAnnouncement extends ServerMessageBase {
	action: "announcement"
	text: string
}

export interface ServerMessageUser extends ServerMessageBase {
	action: "user"
	user: UserInfo
}

export interface UserInfo extends Omit<RoomUserInfo, "status"> {
	isYou?: boolean
	grants: number
}

export type ClientMessage = ClientMessagePlay | ClientMessagePause | ClientMessageSkip | ClientMessageSeek | ClientMessageOrder | ClientMessageChat | ClientMessageKickMe | ClientMessagePlayerStatus | ClientMessagePromote | ClientMessageAuthenticate | ClientMessagePlayNow;

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

export interface ClientMessagePlayerStatus extends ClientMessageBase {
	action: "status"
	status: PlayerStatus
}

export interface ClientMessagePromote extends ClientMessageBase {
	action: "set-role"
	clientId: ClientId
	role: Role
}

export interface ClientMessageAuthenticate extends ClientMessageBase {
	action: "auth"
	token: AuthToken
}

export interface ClientMessagePlayNow extends ClientMessageBase {
	action: "play-now",
	video: VideoId,
}

export type RoomRequest = JoinRequest | LeaveRequest | PlaybackRequest | SkipRequest | SeekRequest | AddRequest | RemoveRequest | OrderRequest | VoteRequest | PromoteRequest | UpdateUser | ChatRequest | UndoRequest | ApplySettingsRequest | PlayNowRequest

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
	UpdateUser,
	ChatRequest,
	UndoRequest,
	ApplySettingsRequest,
	PlayNowRequest,
}

export interface RoomRequestBase {
	type: RoomRequestType
	token?: AuthToken
	client?: ClientId
}

export interface JoinRequest extends RoomRequestBase {
	type: RoomRequestType.JoinRequest
	info: ClientInfo
}

export interface LeaveRequest extends RoomRequestBase {
	type: RoomRequestType.LeaveRequest
	client: ClientId
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
	video: VideoId,
	add: boolean
}

export interface PromoteRequest extends RoomRequestBase {
	type: RoomRequestType.PromoteRequest
	targetClientId: ClientId
	role: Role
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

export interface UndoRequest extends RoomRequestBase {
	type: RoomRequestType.UndoRequest
	event: ServerMessageEvent
}

export interface ApplySettingsRequest extends RoomRequestBase {
	type: RoomRequestType.ApplySettingsRequest,
	settings: Partial<RoomSettings>
}

/**
 * Request that the room play a video immediately, pushing the current video to the queue. If the video is already in the queue, it will be removed from the queue and start playing. If the video is already playing, this will be ignored.
 */
export interface PlayNowRequest extends RoomRequestBase {
	type: RoomRequestType.PlayNowRequest,
	video: VideoId
}
