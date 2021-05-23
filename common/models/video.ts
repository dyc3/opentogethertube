export interface VideoId {
	service: string
	id: string
}

export interface Video extends VideoId {
	title: string
	description?: string
	length: number
	thumbnail: string
	mime?: string
}
