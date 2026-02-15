import express, { type RequestHandler } from "express";
import type { OttResponseBody, RoomListItem } from "ott-common/models/rest-api.js";
import type { QueueMode, Visibility } from "ott-common/models/types.js";
import { Room as DbRoomModel } from "../models/index.js";

const router = express.Router();

// GET /api/user/owned-rooms
// Returns all permanent rooms owned by the currently logged-in user.
// Only rooms from the database are returned. Temporary rooms and live fields are omitted.
const getOwnedRooms: RequestHandler<never, OttResponseBody<{ data: RoomListItem[] }>> = async (
	req,
	res
) => {
	if (!req.user) {
		res.status(401).json({
			success: false,
			error: {
				name: "Unauthorized",
				message: "Not logged in.",
			},
		});
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
		visibility: dbRoom.visibility,
		queueMode: dbRoom.queueMode,
		currentSource: null,
		users: 0,
	}));

	res.json({
		success: true,
		data: ownedRooms,
	});
};

router.get("/owned-rooms", getOwnedRooms);

export default router;
