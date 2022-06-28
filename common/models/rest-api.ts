import { Visibility } from "./types";

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
