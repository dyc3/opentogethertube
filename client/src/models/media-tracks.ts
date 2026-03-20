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

export interface ManifestSource {
	url: string;
	contentType: string;
	quality: number;
	bitrate?: number;
}

export interface ManifestTextTrack {
	url: string;
	contentType: string;
	name?: string;
	srclang: string;
	default?: boolean;
}

export interface CustomMediaManifest {
	title: string;
	duration: number;
	live?: boolean;
	thumbnail?: string;
	sources: ManifestSource[];
	textTracks?: ManifestTextTrack[];
}
