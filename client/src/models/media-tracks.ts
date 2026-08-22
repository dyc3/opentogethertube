export interface VideoTrack {
	label?: number | string;
	width: number;
	height: number;
	bitrate?: number;
}

export interface CaptionTrack {
	kind?: "subtitles" | "captions";
	label?: string;
	srclang?: string; // If kind is "subtitles", srclang must be defined
	default?: boolean;
}
