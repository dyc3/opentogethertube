import type { Category } from "sponsorblock-api";

export const ANNOUNCEMENT_CHANNEL = "announcement";
export const ROOM_NAME_REGEX = /^[a-z0-9_-]+$/i;
export const USERNAME_LENGTH_MAX = 48;
export const ALL_VIDEO_SERVICES = [
	"youtube",
	"vimeo",
	"direct",
	"hls",
	"dash",
	"tubi",
	"reddit",
	"googledrive",
	"peertube",
	"pluto",
] as const;
export const ALL_SKIP_CATEGORIES: Category[] = [
	"sponsor",
	"intro",
	"outro",
	"interaction",
	"selfpromo",
	"music_offtopic",
	"preview",
] as const;
