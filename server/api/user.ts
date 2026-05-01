import express, { type RequestHandler } from "express";
import type {
	OttApiResponseAccount,
	OttApiRequestAccountUpdate,
	OttApiError,
	OttResponseBody,
	RoomListItem,
} from "ott-common/models/rest-api.js";
import type { QueueMode, Visibility } from "ott-common/models/types.js";
import { OttApiRequestAccountUpdateSchema } from "ott-common/models/zod-schemas.js";
import { Room as DbRoomModel } from "../models/index.js";
import { consumeRateLimitPoints } from "../rate-limit.js";
import usermanager from "../usermanager.js";

const router = express.Router();
const ACCOUNT_READ_RATE_LIMIT_POINTS = 1;
const ACCOUNT_WRITE_RATE_LIMIT_POINTS = 10;

type AccountUpdateError = OttApiError & {
	fields?: string[];
};

function unauthorized(res: express.Response) {
	res.status(401).json({
		success: false,
		error: {
			name: "Unauthorized",
			message: "Not logged in.",
		},
	});
}

// GET /api/user/account
const getAccount: RequestHandler<never, OttResponseBody<OttApiResponseAccount>> = async (
	req,
	res,
) => {
	if (!req.user) {
		unauthorized(res);
		return;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, ACCOUNT_READ_RATE_LIMIT_POINTS))) {
		return;
	}

	res.json({
		success: true,
		username: req.user.username,
		email: req.user.email,
		discordLinked: !!req.user.discordId,
		hasPassword: !!(req.user.hash && req.user.salt),
	});
};

// PATCH /api/user/account
const patchAccount: RequestHandler<
	never,
	OttResponseBody<unknown, AccountUpdateError>,
	OttApiRequestAccountUpdate
> = async (req, res) => {
	if (!req.user) {
		unauthorized(res);
		return;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, ACCOUNT_WRITE_RATE_LIMIT_POINTS))) {
		return;
	}

	const parsed = OttApiRequestAccountUpdateSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({
			success: false,
			error: {
				name: "ValidationError",
				message: parsed.error.issues[0]?.message ?? "Invalid account update request.",
			},
		});
		return;
	}

	const { email, newPassword } = parsed.data;
	const { currentPassword } = parsed.data;

	if (email !== undefined) {
		if (req.user.email !== email && (await usermanager.isEmailTaken(email))) {
			res.status(400).json({
				success: false,
				error: {
					name: "AlreadyInUse",
					fields: ["email"],
					message: "Email is already associated with an account.",
				},
			});
			return;
		}

		req.user.email = email;
	}

	if (newPassword !== undefined) {
		if (req.user.hash || req.user.salt) {
			if (!currentPassword) {
				res.status(400).json({
					success: false,
					error: {
						name: "CurrentPasswordRequired",
						message: "Current password is required.",
					},
				});
				return;
			}

			const isCurrentPasswordValid = await usermanager.verifyUserPassword(
				req.user,
				currentPassword,
			);
			if (!isCurrentPasswordValid) {
				res.status(400).json({
					success: false,
					error: {
						name: "InvalidPassword",
						message: "Current password is incorrect.",
					},
				});
				return;
			}
		}

		try {
			await usermanager.changeUserPassword(req.user, newPassword);
		} catch (err) {
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
			return;
		}
	} else if (email !== undefined) {
		await req.user.save();
	}

	res.json({
		success: true,
	});
};

// DELETE /api/user/account/discord
const deleteDiscordLink: RequestHandler<never, OttResponseBody> = async (req, res) => {
	if (!req.user) {
		unauthorized(res);
		return;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, ACCOUNT_WRITE_RATE_LIMIT_POINTS))) {
		return;
	}

	if (!req.user.discordId) {
		res.status(400).json({
			success: false,
			error: {
				name: "DiscordNotLinked",
				message: "This account is not linked to Discord.",
			},
		});
		return;
	}

	if (!req.user.hash || !req.user.salt) {
		res.status(400).json({
			success: false,
			error: {
				name: "PasswordRequired",
				message: "Add a password before unlinking Discord.",
			},
		});
		return;
	}

	req.user.discordId = null;
	await req.user.save();

	res.json({
		success: true,
	});
};

// GET /api/user/owned-rooms
// Returns all permanent rooms owned by the currently logged-in user.
// Only rooms from the database are returned. Temporary rooms and live fields are omitted.
const getOwnedRooms: RequestHandler<never, OttResponseBody<{ data: RoomListItem[] }>> = async (
	req,
	res,
) => {
	if (!req.user) {
		unauthorized(res);
		return;
	}

	const dbRooms = await DbRoomModel.findAll({
		where: { ownerId: req.user.id },
	});

	const ownedRooms: RoomListItem[] = dbRooms.map(dbRoom => ({
		name: dbRoom.name,
		title: dbRoom.title,
		description: dbRoom.description,
		isTemporary: false,
		visibility: dbRoom.visibility as Visibility,
		queueMode: dbRoom.queueMode as QueueMode,
		currentSource: null,
		users: 0,
	}));

	res.json({
		success: true,
		data: ownedRooms,
	});
};

router.get("/account", getAccount);
router.patch("/account", patchAccount);
router.delete("/account/discord", deleteDiscordLink);
router.get("/owned-rooms", getOwnedRooms);

export default router;
