import {
	ClientId,
	ClientInfo,
	QueueMode,
	RoomUserInfo,
	Visibility,
	PlayerStatus,
	Role,
	RoomEventContext,
	RoomSettings,
	AuthToken,
} from "./types";
import { VideoId } from "./video";

export type ServerMessage =
	| ServerMessageSync
	| ServerMessageUnload
	| ServerMessageChat
	| ServerMessageEvent
	| ServerMessageEventCustom
	| ServerMessageAnnouncement
	| ServerMessageUser
	| ServerMessageYou;

export type ServerMessageActionType = ServerMessage["action"];

interface ServerMessageBase {
	action: string;
}

export interface ServerMessageSync extends ServerMessageBase {
	action: "sync";
	name?: string;
	title?: string;
	description?: string;
	isTemporary?: boolean;
	visibility?: Visibility;
	queueMode?: QueueMode;
	isPlaying?: boolean;
	playbackPosition?: number;
}

/**
 * The server has unloaded the room, and all clients should be disconnected, and not try to reconnect.
 * This message is not actually sent through the websocket, but instead tells the client manager to disconnect all clients
 * with the appropriate status code.
 */
export interface ServerMessageUnload extends ServerMessageBase {
	action: "unload";
}

export interface ServerMessageChat extends ServerMessageBase {
	action: "chat";
	from: RoomUserInfo;
	text: string;
}

export interface ServerMessageEvent extends ServerMessageBase {
	action: "event";
	request: RoomRequest;
	user: Pick<RoomUserInfo, "name" | "isLoggedIn">;
	additional: RoomEventContext;
}

export interface ServerMessageEventCustom extends ServerMessageBase {
	action: "eventcustom";
	text: string;
	duration?: number;
}

export interface ServerMessageAnnouncement extends ServerMessageBase {
	action: "announcement";
	text: string;
}

export interface ServerMessageUser extends ServerMessageBase {
	action: "user";
	update: UserUpdate;
}

export interface ServerMessageYou extends ServerMessageBase {
	action: "you";
	info: {
		id: ClientId;
	};
}

export type UserUpdate =
	| {
			kind: "init";
			value: RoomUserInfo[];
	  }
	| {
			// can be used to update an existing user, or add a new user
			kind: "update";
			value: PartialUserInfo;
	  }
	| {
			kind: "remove";
			value: ClientId;
	  };

export type PartialUserInfo = Required<Pick<RoomUserInfo, "id">> &
	Partial<Omit<RoomUserInfo, "id">>;

/** @deprecated: should no longer be used */
export interface UserInfo extends RoomUserInfo {
	grants: number;
}

export type ClientMessage =
	| ClientMessageKickMe
	| ClientMessagePlayerStatus
	| ClientMessageAuthenticate
	| ClientMessageRoomRequest;

interface ClientMessageBase {
	action: string;
}

export interface ClientMessageKickMe extends ClientMessageBase {
	action: "kickme";
	reason?: number;
}

/**
 * Inform the server of the client's video player status.
 */
export interface ClientMessagePlayerStatus extends ClientMessageBase {
	action: "status";
	status: PlayerStatus;
}

export interface ClientMessageAuthenticate extends ClientMessageBase {
	action: "auth";
	token: AuthToken;
}

export interface ClientMessageRoomRequest extends ClientMessageBase {
	action: "req";
	request: RoomRequest;
}

/**
 * Provides a user's authorization for a room request. This is NOT safe to send to the client.
 */
export interface RoomRequestAuthorization {
	token: AuthToken;
}

/**
 * When a room request is authorized, this information can be safely derived from the token. This information is safe to send to the client.
 */
export interface RoomRequestContext {
	username: string;
	role: Role;
	/** If the user is connected to the room, then we can use it's client id to identify the websocket connection. */
	clientId?: ClientId;
}

export type RoomRequest =
	| JoinRequest
	| LeaveRequest
	| PlaybackRequest
	| SkipRequest
	| SeekRequest
	| AddRequest
	| RemoveRequest
	| OrderRequest
	| VoteRequest
	| PromoteRequest
	| UpdateUser
	| ChatRequest
	| UndoRequest
	| ApplySettingsRequest
	| PlayNowRequest
	| ShuffleRequest;

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
	ShuffleRequest,
}

export interface RoomRequestBase {
	type: RoomRequestType;
}

export interface JoinRequest extends RoomRequestBase {
	type: RoomRequestType.JoinRequest;
	/**
	 * We need to know the user's token when they join the room in order to authorize their later requests without pinging redis.
	 */
	token: AuthToken;
	info: ClientInfo;
}

export interface LeaveRequest extends RoomRequestBase {
	type: RoomRequestType.LeaveRequest;
}

export interface PlaybackRequest extends RoomRequestBase {
	type: RoomRequestType.PlaybackRequest;
	state: boolean;
}

export interface SkipRequest extends RoomRequestBase {
	type: RoomRequestType.SkipRequest;
}

export interface SeekRequest extends RoomRequestBase {
	type: RoomRequestType.SeekRequest;
	value: number;
}

export interface AddRequest extends RoomRequestBase {
	type: RoomRequestType.AddRequest;
	video?: VideoId;
	videos?: VideoId[];
	url?: string;
}

export interface RemoveRequest extends RoomRequestBase {
	type: RoomRequestType.RemoveRequest;
	video: VideoId;
}

export interface OrderRequest extends RoomRequestBase {
	type: RoomRequestType.OrderRequest;
	fromIdx: number;
	toIdx: number;
}

export interface VoteRequest extends RoomRequestBase {
	type: RoomRequestType.VoteRequest;
	video: VideoId;
	add: boolean;
}

export interface PromoteRequest extends RoomRequestBase {
	type: RoomRequestType.PromoteRequest;
	targetClientId: ClientId;
	role: Role;
}

/**
 * Request that the client manager pull new information about the user, and inform rooms.
 */
export interface UpdateUser extends RoomRequestBase {
	type: RoomRequestType.UpdateUser;
	info: ClientInfo;
}

export interface ChatRequest extends RoomRequestBase {
	type: RoomRequestType.ChatRequest;
	text: string;
}

export interface UndoRequest extends RoomRequestBase {
	type: RoomRequestType.UndoRequest;
	event: ServerMessageEvent;
}

export interface ApplySettingsRequest extends RoomRequestBase {
	type: RoomRequestType.ApplySettingsRequest;
	settings: Partial<RoomSettings>;
}

/**
 * Request that the room play a video immediately, pushing the current video to the queue. If the video is already in the queue, it will be removed from the queue and start playing. If the video is already playing, this will be ignored.
 */
export interface PlayNowRequest extends RoomRequestBase {
	type: RoomRequestType.PlayNowRequest;
	video: VideoId;
}

export interface ShuffleRequest extends RoomRequestBase {
	type: RoomRequestType.ShuffleRequest;
}
