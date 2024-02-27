import { ROOM_NAME_REGEX } from "ott-common/constants";
import { Visibility } from "ott-common/models/types";
import { z } from "zod";

export const createRoomSchema = z.object({
	name: z.string().min(3).max(32),
	title: z.string().max(255).optional(),
	isTemporary: z.boolean().optional(),
	visibility: z.enum([Visibility.Public, Visibility.Unlisted, Visibility.Private]).optional(),
});
