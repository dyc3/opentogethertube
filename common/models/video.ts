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
	/**
	 * URL of the subtitle track to show by default. The field is overloaded by item type:
	 * for custom media manifest items (mime `application/json`) it must equal one of
	 * `textTracks[].url`; for other (direct) items it is an arbitrary external subtitle URL
	 * and is the only subtitle source. `null` and an absent field both mean "no subtitle".
	 */
	defaultSubtitleTrack?: string | null;
}

export type Video = VideoId & Partial<VideoMetadata>;
export interface QueueItemExtras {
	startAt?: number;
	endAt?: number;
	defaultSubtitleTrack?: string | null;
}

export type VideoAdd = VideoId & QueueItemExtras;
export interface QueueItem extends Video, QueueItemExtras {}
