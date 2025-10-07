import { ALL_VIDEO_SERVICES, ROOM_NAME_REGEX } from "ott-common/constants.js";
import { BehaviorOption, QueueMode, Role, Visibility } from "ott-common/models/types.js";
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
