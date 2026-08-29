import type { ALL_VIDEO_SERVICES } from "../constants.js";
import type { CustomMediaTextTrack } from "./zod-schemas.js";

export type VideoService = (typeof ALL_VIDEO_SERVICES)[number];

export interface VideoId {
	service: VideoService;
	id: string;
}

export interface VideoMetadata {
	title: string;
	description: string;
	length: number;
	thumbnail: string;
	mime: string;
	highlight?: true;
	hls_url?: string;
	dash_url?: string;
	src_url?: string;
	textTracks?: CustomMediaTextTrack[];
	subtitleUrl?: string | null;
}

export type Video = VideoId & Partial<VideoMetadata>;
export interface QueueItemExtras {
	startAt?: number;
	endAt?: number;
	/** Kept as `subtitleUrl` for persistence compat — this field is stored by name in Redis and the DB `prevQueue` column. */
	subtitleUrl?: string | null;
}

export type VideoAdd = VideoId & QueueItemExtras;
export interface QueueItem extends Video, QueueItemExtras {}
