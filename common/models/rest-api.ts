import { Grants } from "../permissions";
import { ServerMessageEvent } from "./messages";
import { BehaviorOption, QueueMode, RoomSettings, RoomUserInfo, Visibility } from "./types";
import { QueueItem, Video, VideoId } from "./video";
import { Category } from "sponsorblock-api";
// Adding anything to this file causes lint errors?
// import { createRoomSchema } from "../../server/api/room";
// import { z } from "zod";

export type OttResponseBody<T = unknown, E extends OttApiError = OttApiError> =
	| OttSuccessResponseBody<T>
	| OttErrorResponseBody<E>;

export type OttSuccessResponseBody<T = undefined> = T & {
	success: true;
};

/**
 * Used for /api/data endpoints.
 */
export type OttStaticDataResponseBody<T> = T;

export interface OttErrorResponseBody<E extends OttApiError = OttApiError> {
	success: false;
	error: E;
}

export interface OttApiError {
	name: string;
	message: string;
}

/** Endpoint: `/api/room/generate` */
export interface OttApiResponseRoomGenerate {
	room: string;
}

// export type OttApiRequestRoomCreate = z.infer<typeof createRoomSchema>;

/** Endpoint: `/api/room/create` */
export interface OttApiRequestRoomCreate {
	title?: string;
	name: string;
	isTemporary?: boolean;
	visibility?: Visibility;
}

/** Endpoint: `/api/room/create` */
export interface OttApiResponseRoomCreate { }

/** Endpoint: `GET /api/room/:name` */
export interface OttApiResponseGetRoom extends RoomSettings {
	name: string;
	title: string;
	description: string;
	isTemporary: boolean;
	visibility: Visibility;
	queueMode: QueueMode;
	queue: QueueItem[];
	hasOwner: boolean;
	grants: Grants;
	autoSkipSegmentCategories: Category[];
	/** @deprecated */
	permissions: Grants;
	restoreQueueBehavior: BehaviorOption;
	users: RoomUserInfo[];
}

export interface OttApiRequestPatchRoom extends Partial<RoomSettings> {
	claim?: boolean;
	/** @deprecated Use `grants` instead */
	permissions?: Grants;
}

export interface OttApiRequestUndo {
	event: ServerMessageEvent;
}

export type OttApiRequestAddToQueue =
	| {
		videos: VideoId[];
	}
	| VideoId
	| {
		url: string;
	};

export type OttApiRequestRemoveFromQueue = VideoId;

export type OttApiResponseAddPreview = {
	result: Video[];
};

export interface OttApiRequestVote extends VideoId { }

export type OttApiRequestAccountRecoveryStart = {
	email?: string;
	username?: string;
};

export type OttApiRequestAccountRecoveryVerify = {
	verifyKey: string;
	newPassword: string;
};
