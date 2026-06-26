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
	subtitleUrl?: string;
	/**
	 * The text tracks declared by a custom media manifest. Only present for
	 * manifest (`mime === "application/json"`) items.
	 */
	textTracks?: CustomMediaTextTrack[];
	/**
	 * URL of the text track shown by default for all viewers. For manifest items
	 * the server resolves this from the manifest's `default` track, so it is
	 * always a concrete value: a track URL, or `null` for "no subtitles".
	 */
	defaultSubtitleTrack?: string | null;
}

export type Video = VideoId & Partial<VideoMetadata>;
export interface QueueItemExtras {
	startAt?: number;
	endAt?: number;
	subtitleUrl?: string;
	/**
	 * Overrides the default subtitle track for this queue item. A track URL
	 * selects that manifest track; `null` means "no subtitles". Absent leaves the
	 * server-resolved default untouched.
	 */
	defaultSubtitleTrack?: string | null;
}

export type VideoAdd = VideoId & QueueItemExtras;
export interface QueueItem extends Video, QueueItemExtras {}
