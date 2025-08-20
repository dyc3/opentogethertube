import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import _ from "lodash";
import { OttException } from "ott-common/exceptions.js";
import {
	type AddRequest,
	type ApplySettingsRequest,
	RoomRequestType,
	type UndoRequest,
} from "ott-common/models/messages.js";
import type {
	OttApiRequestAddToQueue,
	OttApiRequestPatchRoom,
	OttApiRequestRemoveFromQueue,
	OttApiRequestRoomCreate,
	OttApiRequestVote,
	OttApiResponseGetRoom,
	OttApiResponseRoomCreate,
	OttApiResponseRoomGenerate,
	OttClaimRequest,
	OttResponseBody,
	OttSettingsRequest,
	RoomListItem,
} from "ott-common/models/rest-api.js";
import { QueueMode, Visibility } from "ott-common/models/types.js";
import { Video } from "ott-common/models/video.js";
import {
	OttApiRequestAddToQueueSchema,
	OttApiRequestPatchRoomSchema,
	OttApiRequestRemoveFromQueueSchema,
	OttApiRequestRoomCreateSchema,
	OttApiRequestRoomGenerateSchema,
	OttApiRequestVoteSchema,
} from "ott-common/models/zod-schemas.js";
import { Grants } from "ott-common/permissions.js";
import { v4 as uuidv4 } from "uuid";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { getApiKey } from "../admin.js";
import clientmanager from "../clientmanager.js";
import { BadApiArgumentException, FeatureDisabledException } from "../exceptions.js";
import { UnloadReason } from "../generated.js";
import { getLogger } from "../logger.js";
import { counterHttpErrors } from "../metrics.js";
import { conf } from "../ott-config.js";
import { consumeRateLimitPoints } from "../rate-limit.js";
import roommanager from "../roommanager.js";
import storage from "../storage.js";

const router = express.Router();
const log = getLogger("api/room");

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

const generateRoom: RequestHandler<unknown, OttResponseBody<OttApiResponseRoomGenerate>> = async (
	req,
	res
) => {
	if (!conf.get("room.enable_create_temporary")) {
		throw new FeatureDisabledException("Temporary rooms are disabled.");
	}

	const body = OttApiRequestRoomGenerateSchema.parse(req.body);

	let points = 50;
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}
	let roomName = uuidv4();
	log.debug(`Generating room: ${roomName}`);
	await roommanager.createRoom({
		name: roomName,
		isTemporary: true,
		owner: req.user,
		...body,
	});
	log.info(`room generated: ip=${req.ip} user-agent=${req.headers["user-agent"]}`);
	res.status(201).json({
		success: true,
		room: roomName,
	});
};

const createRoom: RequestHandler<
	unknown,
	OttResponseBody<OttApiResponseRoomCreate>,
	OttApiRequestRoomCreate
> = async (req, res) => {
	const body = OttApiRequestRoomCreateSchema.parse(req.body);

	if (body.isTemporary && !conf.get("room.enable_create_temporary")) {
		throw new FeatureDisabledException("Temporary rooms are disabled.");
	} else if (!body.isTemporary && !conf.get("room.enable_create_permanent")) {
		throw new FeatureDisabledException("Permanent rooms are disabled.");
	}

	let points = 50;

	if (!body.isTemporary) {
		points *= 4;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}

	if (req.user) {
		await roommanager.createRoom({ ...body, owner: req.user });
	} else {
		await roommanager.createRoom(body);
	}
	log.info(
		`${body.isTemporary ? "Temporary" : "Permanent"} room created: name=${body.name} ip=${
			req.ip
		} user-agent=${req.headers["user-agent"]}`
	);
	res.status(201).json({
		success: true,
	});
};

const getRoom: RequestHandler<{ name: string }, OttApiResponseGetRoom, unknown> = async (
	req,
	res
) => {
	const room = (await roommanager.getRoom(req.params.name)).unwrap();
	const resp: OttApiResponseGetRoom = {
		..._.cloneDeep(
			_.pick(room, [
				"name",
				"title",
				"description",
				"isTemporary",
				"visibility",
				"queueMode",
				"users",
				"grants",
				"autoSkipSegmentCategories",
				"restoreQueueBehavior",
				"enableVoteSkip",
			])
		),
		queue: room.queue.items,
		hasOwner: !!room.owner,
	};
	res.json(resp);
};

function isClaimRequest(request: OttApiRequestPatchRoom): request is OttClaimRequest {
	return "claim" in request;
}

const patchRoom: RequestHandler<{ name: string }, unknown, OttApiRequestPatchRoom> = async (
	req,
	res
) => {
	const body = OttApiRequestPatchRoomSchema.parse(req.body);

	if (!req.token) {
		throw new OttException("Missing token");
	}

	const result = await roommanager.getRoom(req.params.name);
	if (!result.ok) {
		throw result.value;
	}
	const room = result.value;

	if (isClaimRequest(body)) {
		if (body.claim) {
			if (room.owner) {
				throw new BadApiArgumentException("claim", `Room already has owner.`);
			}

			if (req.user) {
				log.info(`Room ${room.name} claimed by ${req.user.username} (${req.user.id})`);
				room.owner = req.user;
				// HACK: force the room to send the updated user info to the client
				for (const user of room.realusers) {
					if (user.user_id === room.owner?.id) {
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
	} else {
		const newBody = {
			...body,
			grants: new Grants(body.grants),
		};
		const roomRequest: ApplySettingsRequest = {
			type: RoomRequestType.ApplySettingsRequest,
			settings: newBody,
		};

		await room.processUnauthorizedRequest(roomRequest, { token: req.token });
	}

	if (!room.isTemporary) {
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

const deleteRoom: RequestHandler<
	{ name: string },
	OttResponseBody<unknown>,
	unknown,
	{ permanent?: string }
> = async (req, res) => {
	// If permanent=true, allow the room owner to permanently delete their own room (DB + unload)
	const permanent = req.query.permanent === "true";

	if (permanent) {
		// Must be logged in
		if (!req.user) {
			res.status(401).json({
				success: false,
				error: {
					name: "Unauthorized",
					message: "Must be logged in to permanently delete a room.",
				},
			});
			return;
		}

		// Load the room (loads from storage if needed) to validate ownership
		const room = (await roommanager.getRoom(req.params.name)).unwrap();

		// Only permanent rooms can be permanently deleted
		if (room.isTemporary) {
			res.status(400).json({
				success: false,
				error: {
					name: "BadApiArgumentException",
					message: "Temporary rooms cannot be permanently deleted.",
				},
			});
			return;
		}

		// Only the owner can permanently delete
		if (!room.owner || room.owner.id !== req.user.id) {
			res.status(403).json({
				success: false,
				error: {
					name: "PermissionDeniedException",
					message: "Only the owner can permanently delete this room.",
				},
			});
			return;
		}

		// Unload and delete from storage
		await roommanager.unloadRoom(req.params.name, UnloadReason.Admin);
		try {
			await storage.deleteRoom(req.params.name);
		} catch (err) {
			if (err instanceof Error) {
				log.error(`Failed to delete room from storage: ${err.message} ${err.stack}`);
			} else {
				log.error(`Failed to delete room from storage`);
			}
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "Failed to delete room from storage.",
				},
			});
			return;
		}

		res.json({
			success: true,
		});
		return;
	}

	// If not permanent deletion, require admin apikey to unload a room
	const isAuthorized = req.get("apikey") === getApiKey();
	if (!isAuthorized) {
		res.status(400).json({
			success: false,
			error: {
				name: "Unauthorized",
				message: "Admin apikey is required to unload a room.",
			},
		});
		return;
	}
	await roommanager.unloadRoom(req.params.name, UnloadReason.Admin);
	res.json({
		success: true,
	});
};

const undoEvent: RequestHandler<{ name: string }> = async (req, res) => {
	if (!req.token) {
		throw new OttException("Missing token");
	}
	const client = clientmanager.getClientByToken(req.token, req.params.name);
	const request: UndoRequest = {
		type: RoomRequestType.UndoRequest,
		event: req.body.data.event,
	};

	await clientmanager.makeRoomRequest(client, request);
	res.json({
		success: true,
	});
};

const addVote: RequestHandler<{ name: string }, unknown, OttApiRequestVote> = async (req, res) => {
	const body = OttApiRequestVoteSchema.parse(req.body);

	if (!req.token) {
		throw new OttException("Missing token");
	}

	const client = clientmanager.getClientByToken(req.token, req.params.name);
	await clientmanager.makeRoomRequest(client, {
		type: RoomRequestType.VoteRequest,
		video: { service: body.service, id: body.id },
		add: true,
	});
	res.json({
		success: true,
	});
};

const removeVote: RequestHandler<{ name: string }, unknown, OttApiRequestVote> = async (
	req,
	res
) => {
	const body = OttApiRequestVoteSchema.parse(req.body);

	if (!req.token) {
		throw new OttException("Missing token");
	}

	const client = clientmanager.getClientByToken(req.token, req.params.name);
	await clientmanager.makeRoomRequest(client, {
		type: RoomRequestType.VoteRequest,
		video: { service: body.service, id: body.id },
		add: false,
	});
	res.json({
		success: true,
	});
};

const addToQueue: RequestHandler<
	{ name: string },
	OttResponseBody<unknown>,
	OttApiRequestAddToQueue
> = async (req, res) => {
	const body = OttApiRequestAddToQueueSchema.parse(req.body);
	let points = 5;
	if ("videos" in body) {
		points = 3 * body.videos.length;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}
	const room = (await roommanager.getRoom(req.params.name)).unwrap();

	let roomRequest: AddRequest;
	if ("videos" in body) {
		roomRequest = {
			type: RoomRequestType.AddRequest,
			videos: body.videos,
		};
	} else if ("url" in body) {
		roomRequest = {
			type: RoomRequestType.AddRequest,
			url: body.url,
		};
	} else {
		roomRequest = {
			type: RoomRequestType.AddRequest,
			video: {
				service: body.service,
				id: body.id,
			},
		};
	}

	await room.processUnauthorizedRequest(roomRequest, { token: req.token! });
	res.json({
		success: true,
	});
};

const removeFromQueue: RequestHandler<
	{ name: string },
	OttResponseBody<unknown>,
	OttApiRequestRemoveFromQueue
> = async (req, res) => {
	const body = OttApiRequestRemoveFromQueueSchema.parse(req.body);
	let points = 5;
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}
	const room = (await roommanager.getRoom(req.params.name)).unwrap();

	await room.processUnauthorizedRequest(
		{
			type: RoomRequestType.RemoveRequest,
			video: { service: body.service, id: body.id },
		},
		{ token: req.token! }
	);
	res.json({
		success: true,
	});
};

const errorHandler: ErrorRequestHandler = (err: Error, req, res) => {
	counterHttpErrors.labels({ error: err.name }).inc();
	if (err instanceof OttException) {
		log.debug(`OttException: path=${req.path} name=${err.name}`);
		// FIXME: allow for type narrowing based on err.name
		if (err.name === "RoomNotFoundException") {
			res.status(404).json({
				success: false,
				error: {
					name: err.name,
					message: "Room not found",
				},
			});
		} else if (
			err.name === "VideoAlreadyQueuedException" ||
			err.name === "PermissionDeniedException" ||
			err.name === "ClientNotFoundInRoomException"
		) {
			log.warn(`Failed to post video: ${err.name}`);
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
		} else if (err.name === "BadApiArgumentException") {
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
		} else if (err.name === "FeatureDisabledException") {
			// biome-ignore lint/correctness/noUnusedVariables: biome migration
			const e = err as FeatureDisabledException;
			res.status(403).json({
				success: false,
				error: {
					name: "FeatureDisabledException",
					message: err.message,
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
	} else if (err instanceof ZodError) {
		err = fromZodError(err);
		res.status(400).json({
			success: false,
			error: {
				...err,
				message: err.message,
			},
		});
	} else {
		log.error(`Unhandled exception: path=${req.path} ${err.name} ${err.message} ${err.stack}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "An unknown error occurred. Try again later.",
			},
		});
	}
};

// HACK: Ideally, this error handling would be handled with a proper express error handler.
// I was not able to figure out how to make it work in this context, so this is what we are stuck with.
router.post("/generate", async (req, res, next) => {
	try {
		await generateRoom(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.post("/create", async (req, res, next) => {
	try {
		await createRoom(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.get("/:name", async (req, res, next) => {
	try {
		await getRoom(req, res, next);
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
		await deleteRoom(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.post("/:name/undo", async (req, res, next) => {
	try {
		await undoEvent(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.post("/:name/vote", async (req, res, next) => {
	try {
		await addVote(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.delete("/:name/vote", async (req, res, next) => {
	try {
		await removeVote(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.post("/:name/queue", async (req, res, next) => {
	try {
		await addToQueue(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

router.delete("/:name/queue", async (req, res, next) => {
	try {
		await removeFromQueue(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

export default router;
