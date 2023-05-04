import { Grants } from "permissions";
import { QueueMode, RoomSettings, RoomUserInfo, Visibility } from "./types";
import { QueueItem } from "./video";

export type OttResponseBody<T = undefined, E extends OttApiError = OttApiError> =
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
export interface OttApiRequestRoomCreate {
	name: string;
	isTemporary?: boolean;
	visibility?: Visibility;
}

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
	/** @deprecated */
	permissions: Grants;
	autoSkipSegments: boolean;
	users: RoomUserInfo[];
}
