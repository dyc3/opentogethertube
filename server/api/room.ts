import _ from "lodash";
import { getLogger } from "../logger.js";
import roommanager from "../roommanager";
import { QueueMode, Visibility } from "../../common/models/types";
import { consumeRateLimitPoints } from "../rate-limit";
import { BadApiArgumentException } from "../exceptions";
import { OttException } from "../../common/exceptions";
import express, { RequestHandler, ErrorRequestHandler } from "express";
import clientmanager from "../clientmanager";
import { ApplySettingsRequest, RoomRequestType, UndoRequest } from "../../common/models/messages";
import storage from "../storage";
import { Grants } from "../../common/permissions";
import { Video } from "common/models/video.js";
import { ROOM_NAME_REGEX } from "../../common/constants";
import {
	OttApiRequestRoomCreate,
	OttApiResponseRoomCreate,
	OttResponseBody,
} from "../../common/models/rest-api";
import { getApiKey } from "../admin";

const router = express.Router();
const log = getLogger("api/room");

// These strings are not allowed to be used as room names.
const RESERVED_ROOM_NAMES = ["list", "create", "generate"];

const VALID_ROOM_VISIBILITY = [Visibility.Public, Visibility.Unlisted, Visibility.Private];

const VALID_ROOM_QUEUE_MODE = [QueueMode.Manual, QueueMode.Vote, QueueMode.Loop, QueueMode.Dj];

interface RoomListItem {
	name: string;
	title: string;
	description: string;
	isTemporary: boolean;
	visibility: Visibility;
	queueMode: QueueMode;
	currentSource: Video | null;
	users: number;
}

router.get("/list", (req, res) => {
	const isAuthorized = req.get("apikey") === getApiKey();
	if (req.get("apikey") && !isAuthorized) {
		log.warn(
			`Unauthorized request to room list endpoint: ip=${req.ip} forward-ip=${(
				req.headers["x-forwarded-for"] ?? "not-present"
			).toString()} user-agent=${req.headers["user-agent"]}`
		);
		res.status(400).json({
			success: false,
			error: "apikey is invalid",
		});
		return;
	}
	let rooms: RoomListItem[] = [];
	for (const room of roommanager.rooms) {
		if (room.visibility !== Visibility.Public && !isAuthorized) {
			continue;
		}
		const obj: RoomListItem = {
			name: room.name,
			title: room.title,
			description: room.description,
			isTemporary: room.isTemporary,
			visibility: room.visibility,
			queueMode: room.queueMode,
			currentSource: room.currentSource,
			users: room.users.length,
		};
		rooms.push(obj);
	}
	rooms = _.orderBy(rooms, ["users", "name"], ["desc", "asc"]);
	res.json(rooms);
});

const createRoom: RequestHandler<
	unknown,
	OttResponseBody<OttApiResponseRoomCreate>,
	OttApiRequestRoomCreate
> = async (req, res) => {
	function isValidCreateRoom(body: any): body is OttApiRequestRoomCreate {
		return !!body.name;
	}
	if (!isValidCreateRoom(req.body)) {
		throw new BadApiArgumentException("name", "missing");
	}
	if (!req.body.name) {
		throw new BadApiArgumentException("name", "missing");
	}
	if (RESERVED_ROOM_NAMES.includes(req.body.name)) {
		throw new BadApiArgumentException("name", "not allowed (reserved)");
	}
	if (req.body.name.length < 3) {
		throw new BadApiArgumentException(
			"name",
			"not allowed (too short, must be at least 3 characters)"
		);
	}
	if (req.body.name.length > 32) {
		throw new BadApiArgumentException(
			"name",
			"not allowed (too long, must be at most 32 characters)"
		);
	}
	if (!ROOM_NAME_REGEX.exec(req.body.name)) {
		throw new BadApiArgumentException("name", "not allowed (invalid characters)");
	}
	if (req.body.visibility && !VALID_ROOM_VISIBILITY.includes(req.body.visibility)) {
		throw new BadApiArgumentException(
			"visibility",
			`must be one of ${VALID_ROOM_VISIBILITY.toString()}`
		);
	}
	let points = 50;
	if (req.body.isTemporary === undefined) {
		req.body.isTemporary = true;
	}
	if (!req.body.isTemporary) {
		points *= 4;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}

	if (!req.body.visibility) {
		req.body.visibility = Visibility.Public;
	}
	if (req.user) {
		await roommanager.CreateRoom({ ...req.body, owner: req.user });
	} else {
		await roommanager.CreateRoom(req.body);
	}
	log.info(
		`${req.body.isTemporary ? "Temporary" : "Permanent"} room created: name=${
			req.body.name
		} ip=${req.ip} user-agent=${req.headers["user-agent"]}`
	);
	res.json({
		success: true,
	});
};

const patchRoom: RequestHandler = async (req, res) => {
	if (!req.token) {
		throw new OttException("Missing token");
	}
	if (req.body.visibility && !VALID_ROOM_VISIBILITY.includes(req.body.visibility)) {
		throw new BadApiArgumentException(
			"visibility",
			`must be one of ${VALID_ROOM_VISIBILITY.toString()}`
		);
	}
	if (req.body.queueMode && !VALID_ROOM_QUEUE_MODE.includes(req.body.queueMode)) {
		throw new BadApiArgumentException(
			"queueMode",
			`must be one of ${VALID_ROOM_QUEUE_MODE.toString()}`
		);
	}

	if (req.body.permissions) {
		req.body.grants = req.body.permissions;
		delete req.body.permissions;
	}

	req.body.grants = new Grants(req.body.grants);

	const room = await roommanager.GetRoom(req.params.name);
	if (req.body.claim) {
		if (room.isTemporary) {
			throw new BadApiArgumentException("claim", `Can't claim temporary rooms.`);
		} else if (room.owner) {
			throw new BadApiArgumentException("claim", `Room already has owner.`);
		}
	}

	const roomRequest: ApplySettingsRequest = {
		type: RoomRequestType.ApplySettingsRequest,
		settings: req.body,
	};

	await room.processUnauthorizedRequest(roomRequest, { token: req.token });

	if (!room.isTemporary) {
		if (req.body.claim && !room.owner) {
			if (req.user) {
				room.owner = req.user;
				// HACK: force the room to send the updated user info to the client
				for (const user of room.realusers) {
					if (user.user_id === room.owner.id) {
						room.syncUser(room.getUserInfo(user.id));
						break;
					}
				}
			} else {
				res.status(401).json({
					success: false,
					error: {
						message: "Must be logged in to claim room ownership.",
					},
				});
				return;
			}
		}

		try {
			await storage.updateRoom(room);
		} catch (err) {
			if (err instanceof Error) {
				log.error(`Failed to update room: ${err.message} ${err.stack}`);
			} else {
				log.error(`Failed to update room`);
			}
			res.status(500).json({
				success: false,
			});
			return;
		}
	}

	res.json({
		success: true,
	});
};

const deleteRoom: RequestHandler = async (req, res) => {
	const isAuthorized = req.get("apikey") === getApiKey();
	if (!isAuthorized) {
		res.status(400).json({
			success: false,
			error: "apikey is required",
		});
		return;
	}
	await roommanager.UnloadRoom(req.params.name);
	res.json({
		success: true,
	});
};

const undoEvent = async (req: express.Request, res) => {
	if (!req.token) {
		throw new OttException("Missing token");
	}
	const client = clientmanager.getClient(req.token, req.params.name);
	const request: UndoRequest = {
		type: RoomRequestType.UndoRequest,
		event: req.body.data.event,
	};

	await client.makeRoomRequest(request);
	res.json({
		success: true,
	});
};

const addVote = async (req: express.Request, res) => {
	if (!req.token) {
		throw new OttException("Missing token");
	}
	if (!req.body.service) {
		throw new BadApiArgumentException("service", "missing");
	}
	if (!req.body.id) {
		throw new BadApiArgumentException("id", "missing");
	}

	const client = clientmanager.getClient(req.token, req.params.name);
	await client.makeRoomRequest({
		type: RoomRequestType.VoteRequest,
		video: { service: req.body.service, id: req.body.id },
		add: true,
	});
	res.json({
		success: true,
	});
};

const removeVote = async (req: express.Request, res) => {
	if (!req.token) {
		throw new OttException("Missing token");
	}
	if (!req.body.service) {
		throw new BadApiArgumentException("service", "missing");
	}
	if (!req.body.id) {
		throw new BadApiArgumentException("id", "missing");
	}

	const client = clientmanager.getClient(req.token, req.params.name);
	await client.makeRoomRequest({
		type: RoomRequestType.VoteRequest,
		video: { service: req.body.service, id: req.body.id },
		add: false,
	});
	res.json({
		success: true,
	});
};

const errorHandler: ErrorRequestHandler = (err: Error, req, res) => {
	if (err instanceof OttException) {
		log.debug(`OttException: path=${req.path} name=${err.name}`);
		// FIXME: allow for type narrowing based on err.name
		if (err.name === "BadApiArgumentException") {
			const e = err as BadApiArgumentException;
			res.status(400).json({
				success: false,
				error: {
					name: "BadApiArgumentException",
					message: err.message,
					arg: e.arg,
					reason: e.reason,
				},
			});
		} else {
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
		}
	} else {
		log.error(`Unhandled exception: path=${req.path} ${err.name} ${err.message} ${err.stack}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "An unknown error occured. Try again later.",
			},
		});
	}
};

// HACK: Ideally, this error handling would be handled with a proper express error handler.
// I was not able to figure out how to make it work in this context, so this is what we are stuck with.
router.post("/create", async (req, res, next) => {
	try {
		await createRoom(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.patch("/:name", async (req, res, next) => {
	try {
		await patchRoom(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.delete("/:name", async (req, res, next) => {
	try {
		await deleteRoom(req as express.Request, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.post("/:name/undo", async (req, res, next) => {
	try {
		await undoEvent(req as express.Request, res);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.post("/:name/vote", async (req, res, next) => {
	try {
		await addVote(req as express.Request, res);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.delete("/:name/vote", async (req, res, next) => {
	try {
		await removeVote(req as express.Request, res);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

export default router;
