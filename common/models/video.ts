export interface VideoId {
	service: string
	id: string
}

// export type Video = VideoDefault | VideoGoogleDrive | VideoDirect

export interface VideoDefault extends VideoId {
	title: string | null
	description: string | null
	length: number | null
	thumbnail: string | null
}

export interface VideoGoogleDrive extends VideoId {
	service: "googledrive"
	title: string | null
	length: number | null
	thumbnail: string | null
	mime: string | null
}

export interface VideoDirect extends VideoId {
	service: "direct"
	title: string | null
	description: string | null
	length: number | null
	mime: string | null
}

export interface Video extends VideoId {
	title?: string | null
	description?: string | null
	length?: number | null
	thumbnail?: string | null
	mime?: string | null
	highlight?: boolean
}

export type VideoMetadata = Omit<Video, keyof VideoId | "highlight">
