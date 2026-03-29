import { ALL_VIDEO_SERVICES, ROOM_NAME_REGEX } from "ott-common/constants.js";
import { BehaviorOption, Role } from "ott-common/models/types.js";
import { Visibility, QueueMode } from "ott-common/models/types.js";
import { z } from "zod";

// These strings are not allowed to be used as room names.
const RESERVED_ROOM_NAMES = ["list", "create", "generate"];

const CategorySchema = z.enum([
	"sponsor",
	"intro",
	"outro",
	"interaction",
	"selfpromo",
	"music_offtopic",
	"preview",
]);

export const OttApiRequestRoomGenerateSchema = z.object({
	autoSkipSegmentCategories: z.array(CategorySchema).optional(),
});

export const OttApiRequestRoomCreateSchema = z
	.object({
		name: z
			.string()
			.min(3, "too short, must be atleast 3 characters")
			.max(32, "too long, must be at most 32 characters")
			.regex(ROOM_NAME_REGEX)
			.refine(name => !RESERVED_ROOM_NAMES.includes(name), {
				message: "not allowed (reserved)",
			}),
		title: z.string().max(255, "too long, must be at most 255 characters").optional(),
		description: z.string().optional(),
		isTemporary: z.boolean().optional().default(true),
		visibility: z.nativeEnum(Visibility).default(Visibility.Public).optional(),
		queueMode: z.nativeEnum(QueueMode).optional(),
	})
	.merge(OttApiRequestRoomGenerateSchema);

const VideoIdSchema = z.object({
	service: z.enum(ALL_VIDEO_SERVICES),
	id: z.string(),
	subtitleUrl: z.string().url().optional(),
});

export const OttApiRequestVoteSchema = z.object({
	...VideoIdSchema.shape,
});

export const OttApiRequestAddToQueueSchema = z.union([
	z.object({
		videos: z.array(VideoIdSchema),
	}),
	VideoIdSchema,
	z.object({
		url: z.string(),
	}),
]);

export const OttApiRequestRemoveFromQueueSchema = z.object({
	...VideoIdSchema.shape,
});

export const OttApiRequestAccountRecoveryStartSchema = z.union([
	z.object({
		email: z.string().email().min(3),
	}),
	z.object({
		username: z.string(),
	}),
]);

export const OttApiRequestAccountRecoveryVerifySchema = z.object({
	verifyKey: z.string(),
	newPassword: z.string(),
});

const GrantSchema = z.tuple([z.nativeEnum(Role), z.number()]);

export const RoomSettingsSchema = z
	.object({
		title: z.string().max(254).optional(),
		description: z.string().optional(),
		visibility: z.nativeEnum(Visibility).optional(),
		queueMode: z.nativeEnum(QueueMode).optional(),
		grants: z.array(GrantSchema).optional(),
		autoSkipSegmentCategories: z.array(CategorySchema).optional(),
		restoreQueueBehavior: z.nativeEnum(BehaviorOption).optional(),
		enableVoteSkip: z.boolean().optional(),
	})
	.strict();

export const ClaimSchema = z.object({
	claim: z.boolean(),
});

export const OttApiRequestPatchRoomSchema = z.union([RoomSettingsSchema, ClaimSchema]);

const CUSTOM_MEDIA_SOURCE_CONTENT_TYPES = [
	"video/mp4",
	"video/x-matroska",
	"video/webm",
	"video/ogg",
	// "audio/aac",
	// "audio/mp4",
	// "audio/mpeg",
	// "audio/ogg",
] as const;

const CustomMediaSourceSchema = z.object({
	url: z.string().url("source url must be a valid URL"),
	contentType: z.enum(CUSTOM_MEDIA_SOURCE_CONTENT_TYPES, {
		errorMap: () => ({
			message: `contentType must be one of: ${CUSTOM_MEDIA_SOURCE_CONTENT_TYPES.join(", ")}`,
		}),
	}),
	quality: z
		.number({ invalid_type_error: "quality must be a number" })
		.positive("quality must be positive")
		.finite("quality must be finite"),
	bitrate: z
		.number({ invalid_type_error: "bitrate must be a number" })
		.positive("bitrate must be positive")
		.finite("bitrate must be finite")
		.optional(),
});

// const CustomMediaAudioTrackSchema = z.object({
// 	label: z.string().min(1, "label must not be empty"),
// 	language: z
// 		.string()
// 		.min(2, "language must be at least 2 characters")
// 		.max(20, "language must be at most 20 characters"),
// 	url: z.string().url("audio track url must be a valid URL"),
// 	contentType: z
// 		.string({ invalid_type_error: "contentType must be a string" })
// 		.startsWith("audio", "contentType must be an audio MIME type"),
// });

const CustomMediaTextTrackSchema = z.object({
	url: z.string().url("text track url must be a valid URL"),
	contentType: z.literal("text/vtt", { invalid_type_error: "contentType must be text/vtt" }),
	name: z
		.string()
		.min(1, "name must not be empty")
		.max(20, "name must be at most 20 characters")
		.optional(),
	// If kind is "subtitles", srclang must be defined
	srclang: z
		.string()
		.min(2, "srclang must be at least 2 characters")
		.max(8, "srclang must be at most 8 characters"),
	default: z.boolean().optional(),
});

export const CustomMediaManifestSchema = z.object({
	title: z
		.string()
		.min(1, "title must not be empty")
		.max(100, "title must be at most 100 characters"),
	duration: z
		.number({ invalid_type_error: "duration must be a number" })
		.nonnegative("duration must be non-negative")
		.finite("duration must be finite"),
	live: z.boolean().optional().default(false),
	thumbnail: z.string().url("thumbnail must be a valid URL").optional(),
	sources: z.array(CustomMediaSourceSchema).min(1, "at least one source is required"),
	// audioTracks: z.array(CustomMediaAudioTrackSchema).optional(),
	textTracks: z.array(CustomMediaTextTrackSchema).optional(),
});

export type CustomMediaManifest = z.infer<typeof CustomMediaManifestSchema>;
