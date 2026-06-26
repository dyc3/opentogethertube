import type { ALL_VIDEO_SERVICES } from "../constants.js";

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
	defaultSubtitleTrack?: string | null;
}

export type Video = VideoId & Partial<VideoMetadata>;
export interface QueueItemExtras {
	startAt?: number;
	endAt?: number;
	subtitleUrl?: string;
	/**
	 * URL of the text track that should be selected by default for all viewers.
	 * `""` means no subtitles by default, `null` or absent means use the manifest's default flag.
	 */
	defaultSubtitleTrack?: string | null;
}

export type VideoAdd = VideoId & QueueItemExtras;
export interface QueueItem extends Video, QueueItemExtras {}
