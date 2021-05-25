export interface VideoId {
	service: string
	id: string
}

export type Video = VideoDefault | VideoGoogleDrive | VideoDirect

export interface VideoDefault extends VideoId {
	title: string
	description: string
	length: number
	thumbnail: string
}

export interface VideoGoogleDrive extends VideoId {
	service: "googledrive"
	title: string
	length: number
	thumbnail: string
	mime: string
}

export interface VideoDirect extends VideoId {
	service: "direct"
	title: string
	description: string
	length: number
	mime: string
}

export type VideoMetadata = Omit<Video, keyof VideoId>
