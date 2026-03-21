export interface VideoTrack {
	label?: number;
	width: number;
	height: number;
}

export interface CaptionTrack {
	kind?: "subtitles" | "captions";
	label?: string;
	srclang?: string; // If kind is "subtitles", srclang must be defined
	default?: boolean;
}
