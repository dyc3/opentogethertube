import { Grants } from "../permissions";
import { ServerMessageEvent } from "./messages";
import { BehaviorOption, QueueMode, RoomSettings, RoomUserInfo, Visibility } from "./types";
import { QueueItem, Video, VideoId } from "./video";
import type { Category } from "sponsorblock-api";
import {
	OttApiRequestRoomCreateSchema,
	OttApiRequestVoteSchema,
	OttApiRequestAddToQueueSchema,
	OttApiRequestRemoveFromQueueSchema,
	OttApiRequestAccountRecoveryStartSchema,
	OttApiRequestAccountRecoveryVerifySchema,
	OttApiRequestPatchRoomSchema,
	ClaimSchema,
	RoomSettingsSchema,
} from "./zod-schemas";
import { z } from "zod";

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

/** Endpoint: `/api/room/create` */
export type OttApiRequestRoomCreate = z.infer<typeof OttApiRequestRoomCreateSchema>;

/** Endpoint: `/api/room/create` */
export interface OttApiResponseRoomCreate {}

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
	restoreQueueBehavior: BehaviorOption;
	users: RoomUserInfo[];
}

export type OttApiRequestPatchRoom = z.infer<typeof OttApiRequestPatchRoomSchema>;

export interface OttApiRequestUndo {
	event: ServerMessageEvent;
}

export type OttApiRequestAddToQueue = z.infer<typeof OttApiRequestAddToQueueSchema>;

export type OttApiRequestRemoveFromQueue = z.infer<typeof OttApiRequestRemoveFromQueueSchema>;

export type OttApiResponseAddPreview = {
	result: Video[];
};

export type OttApiRequestVote = z.infer<typeof OttApiRequestVoteSchema>;

export type OttApiRequestAccountRecoveryStart = z.infer<
	typeof OttApiRequestAccountRecoveryStartSchema
>;

export type OttApiRequestAccountRecoveryVerify = z.infer<
	typeof OttApiRequestAccountRecoveryVerifySchema
>;

export type OttClaimRequest = z.infer<typeof ClaimSchema>;

export type OttSettingsRequest = z.infer<typeof RoomSettingsSchema>;
