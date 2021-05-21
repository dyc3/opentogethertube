import { Grants } from "./permissions.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import { getLogger } from "../logger.js";
import winston from "winston";
import { JoinRequest, RoomRequest, RoomRequestType, ServerMessage, ServerMessageSync } from "./messages";
import _ from "lodash";
import Video from "../common/video";
import InfoExtract from "./infoextractor";
import { ROLES } from "./permissions";

const publish = promisify(redisClient.publish).bind(redisClient);
const set = promisify(redisClient.set).bind(redisClient);

export enum Visibility {
	Public,
	Unlisted,
	Private,
}

export enum QueueMode {
	Manual,
	Vote,
	Loop,
	Dj,
}

/**
 * Represents a User from the Room's perspective.
 */
export class RoomUser {
	id: string
	user_id?: number
	username?: string

	constructor(id: string) {
		this.id = id
	}

	public get isLoggedIn() {
		return !!this.user_id
	}
}

export interface RoomOptions {
	name: string
	title: string
	description: string
	visibility: Visibility
	queueMode: QueueMode
	isTemporary: boolean
}

export interface RoomState extends RoomOptions {
	currentSource: Video | null
	queue: Video[]
	isPlaying: boolean
	playbackPosition: number
	grants: Grants
}

export class Room implements RoomState {
	_name: string = "";
	_title: string = "";
	_description: string = "";
	_visibility: Visibility = Visibility.Public;
	_queueMode: QueueMode = QueueMode.Manual;
	isTemporary: boolean = false;

	_currentSource: Video | null = null
	queue: Video[] = []
	_isPlaying: boolean = false
	_playbackPosition: number = 0
	grants: Grants = new Grants();
	users: RoomUser[] = []

	_dirty: Set<keyof RoomState> = new Set();
	log: winston.Logger

	constructor (options: RoomOptions) {
		this.log = getLogger(`room/${options.name}`);
		Object.assign(this, options);
		if (!(this.grants instanceof Grants)) {
			this.grants = new Grants(this.grants);
		}
	}

	public get name() {
		return this._name;
	}

	public set name(value: string) {
		this._name = value;
		this.markDirty("name");
	}

	public get title() {
		// if (this._title.length === 0 && this.isTemporary) {
		// 	return "Temporary Room";
		// }
		return this._title;
	}

	public set title(value: string) {
		this._title = value;
		this.markDirty("title");
	}

	public get description() {
		return this._description;
	}

	public set description(value: string) {
		this._description = value;
		this.markDirty("description");
	}

	public get visibility() {
		return this._visibility;
	}

	public set visibility(value: Visibility) {
		this._visibility = value;
		this.markDirty("visibility");
	}

	public get queueMode() {
		return this._queueMode;
	}

	public set queueMode(value: QueueMode) {
		this._queueMode = value;
		this.markDirty("queueMode");
	}

	public get currentSource() {
		return this._currentSource;
	}

	public set currentSource(value: Video | null) {
		this._currentSource = value;
		this.markDirty("currentSource");
	}

	public get isPlaying() {
		return this._isPlaying;
	}

	public set isPlaying(value: boolean) {
		this._isPlaying = value;
		this.markDirty("isPlaying");
	}

	public get playbackPosition() {
		return this._playbackPosition;
	}

	public set playbackPosition(value: number) {
		this._playbackPosition = value;
		this.markDirty("playbackPosition");
	}

	markDirty(prop: keyof RoomState) {
		this._dirty.add(prop);
		this.throttledSync();
	}

	dequeueNext() {
		if (this.queue.length > 0) {
			this.currentSource = this.queue.shift()!;
			this.markDirty("queue");
			this.playbackPosition = 0;
		}
		else if (this.isPlaying) {
			this.isPlaying = false;
			this.playbackPosition = 0;
			this.currentSource = null;
		}
	}

	/**
	 * Publish a message to the client manager. In general, these messages get sent to all the clients connected, and joined to this room. However, centain messages may be directed at a specific client, depending on what they do.
	 * @param msg The message to publish.
	 */
	async publish(msg: ServerMessage) {
		await publish(`room:${this.name}`, JSON.stringify(msg));
	}

	public async update() {
		if (this.currentSource === null) {
			this.dequeueNext();
		}
	}

	throttledSync = _.debounce(this.sync, 50, { trailing: true })

	public async sync() {
		if (this._dirty.size === 0) {
			return;
		}

		this.log.debug(`synchronizing dirty props: ${Array.from(this._dirty)}`)

		let msg: ServerMessageSync = {
			action: "sync",
		}

		let state: RoomState = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "grants");

		msg = Object.assign(msg, _.pick(state, Array.from(this._dirty)))

		// FIXME: permissions
		msg.grants = this.grants.getMask(ROLES.OWNER);

		await set(`room:${this.name}`, JSON.stringify(state));
		await this.publish(msg);
		this._dirty.clear();
	}

	public async onBeforeUnload() {
		await this.publish({ action: "unload" })
	}

	public async processRequest(request: RoomRequest) {
		// TODO: check permissions, then proceed.

		this.log.info(`processing request: ${request.type}`)

		if (request.type === RoomRequestType.PlaybackRequest) {
			if (request.state) {
				await this.play();
			}
			else {
				await this.pause();
			}
		}
		else if (request.type === RoomRequestType.SkipRequest) {
			await this.skip();
		}
		else if (request.type === RoomRequestType.SeekRequest) {
			await this.seek(request.value);
		}
		else if (request.type === RoomRequestType.AddRequest) {
			if (request.video) {
				await this.addToQueue(request.video);
			}
		}
		else if (request.type === RoomRequestType.RemoveRequest) {
			await this.removeFromQueue(request.video);
		}
		else if (request.type === RoomRequestType.OrderRequest) {
			await this.reorderQueue(request.fromIdx, request.toIdx);
		}
		else if (request.type === RoomRequestType.JoinRequest) {
			await this.joinRoom(request);
		}
	}

	public async play() {
		this.log.debug("playback started");
		this.isPlaying = true;
	}

	public async pause() {
		this.log.debug("playback paused");
		this.isPlaying = false;
	}

	public async skip() {
		this.dequeueNext();
	}

	/**
	 * Seek to the specified position in the video.
	 * @param value
	 */
	public async seek(value: number) {
		if (value === undefined) {
			this.log.error("seek value was undefined");
			return
		}
		this.playbackPosition = value;
	}

	/**
	 * Add the video to the queue. Should only be called after permissions have been checked.
	 * @param video
	 */
	public async addToQueue(video: Video) {
		let queueItem = new Video();

		if (Object.prototype.hasOwnProperty.call(video, "url")) {
			let adapter = InfoExtract.getServiceAdapterForURL(video.url);
			queueItem.service = adapter.serviceId;
			queueItem.id = adapter.getVideoId(video.url);
		}
		else {
			queueItem.service = video.service;
			queueItem.id = video.id;
		}

		queueItem = await InfoExtract.getVideoInfo(queueItem.service, queueItem.id);

		this.queue.push(queueItem);
		this.markDirty("queue");
		this.log.info(`Video added: ${JSON.stringify(queueItem)}`);
	}

	public async removeFromQueue(video: Video) {
		let matchIdx = _.findIndex(this.queue, item => (item.service === video.service && item.id === video.id));
		if (matchIdx < 0) {
			this.log.error(`Could not find video ${JSON.stringify(video)} in queue`);
			return false;
		}
		// remove the item from the queue
		let removed = this.queue.splice(matchIdx, 1)[0];
		this.markDirty("queue");
		// if (session && client) {
		// 	this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.REMOVE_FROM_QUEUE, client.username, { video: removed, queueIdx: matchIdx }));
		// }
		// else {
		// 	this.log.warn("UNABLE TO SEND ROOM EVENT: Couldn't send room event removeFromQueue because no session information was provided.");
		// }
	}

	public async reorderQueue(from: number, to: number) {
		let video = this.queue.splice(from, 1)[0];
		this.queue.splice(to, 0, video);
		this.markDirty("queue");
	}

	public async joinRoom(request: JoinRequest) {
		let user = new RoomUser(request.id)
		user.user_id = request.user_id;
		user.username = request.username;
		this.users.push(user);
		this.log.info(`${user.username} joined the room`);
	}
}
