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
	/**
	 * The text tracks declared by a custom media manifest. Only present for
	 * manifest (`mime === "application/json"`) items.
	 */
	textTracks?: CustomMediaTextTrack[];
	/**
	 * URL of the subtitle track shown by default for all viewers. For manifest
	 * items the server resolves this from the manifest's `default` track. For
	 * non-manifest items it is the URL of an external subtitle file (`.vtt` or
	 * `.ass`). `null` (or absent) means "no subtitles".
	 */
	defaultSubtitleTrack?: string | null;
}

export type Video = VideoId & Partial<VideoMetadata>;
export interface QueueItemExtras {
	startAt?: number;
	endAt?: number;
	/**
	 * Sets the default subtitle track for this queue item. For manifest items a
	 * track URL selects that manifest track; for other items it is the URL of an
	 * external subtitle file (`.vtt` or `.ass`). `null` means "no subtitles".
	 */
	defaultSubtitleTrack?: string | null;
}

export type VideoAdd = VideoId & QueueItemExtras;
export interface QueueItem extends Video, QueueItemExtras {}
