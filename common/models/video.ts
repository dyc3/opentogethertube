import { ALL_VIDEO_SERVICES } from "../constants";

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
}

export type Video = VideoId & Partial<VideoMetadata>;

export interface QueueItemExtras {
	startAt?: number;
	endAt?: number;
}

export type QueueItem = Video & QueueItemExtras;
