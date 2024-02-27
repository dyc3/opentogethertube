import { ROOM_NAME_REGEX } from "ott-common/constants";
import { Visibility } from "ott-common/models/types";
import { z } from "zod";

export const createRoomSchema = z.object({
	name: z
		.string()
		.min(3, "too short, must be atleast 3 characters")
		.max(32, "too long, must be at most 32 characters"),
	title: z.string().max(255, "too long, must be at most 255 characters").optional(),
	isTemporary: z.boolean().optional(),
	visibility: z.enum([Visibility.Public, Visibility.Unlisted, Visibility.Private]).optional(),
});
