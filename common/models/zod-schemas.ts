import { ALL_VIDEO_SERVICES, ROOM_NAME_REGEX } from "ott-common/constants";
import { Visibility, QueueMode } from "ott-common/models/types";
import { z } from "zod";

// These strings are not allowed to be used as room names.
const RESERVED_ROOM_NAMES = ["list", "create", "generate"];

export const OttApiRequestRoomCreateSchema = z.object({
	name: z
		.string()
		.min(3, "too short, must be atleast 3 characters")
		.max(32, "too long, must be at most 32 characters")
		.regex(ROOM_NAME_REGEX)
		.refine(name => !RESERVED_ROOM_NAMES.includes(name), { message: "not allowed (reserved)" }),
	title: z.string().max(255, "too long, must be at most 255 characters").optional(),
	description: z.string().optional(),
	isTemporary: z.boolean().optional().default(true),
	visibility: z.nativeEnum(Visibility).default(Visibility.Public).optional(),
	queueMode: z.nativeEnum(QueueMode).optional(),
});

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
