export interface VideoTrack {
	width: number;
	height: number;
}

export interface CaptionTrack {
	kind?: "subtitles" | "captions";
	label?: string;
	srclang?: string;
	default?: boolean;
}
