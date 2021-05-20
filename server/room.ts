import { Grants } from "./permissions.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import { getLogger } from "../logger.js";
import winston from "winston";
import { ServerMessageSync } from "./messages";
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

	public async update() {
		if (this.currentSource === null) {
			if (this.queue.length > 0) {
				this.currentSource = this.queue.shift()!;
				this.markDirty("queue");
			}
			else if (this.isPlaying) {
				this.isPlaying = false;
				this.playbackPosition = 0;
			}
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
		await publish(`room:${this.name}`, JSON.stringify(msg));
		this._dirty.clear();
	}

	public async play() {
		this.log.debug("playback started");
		this.isPlaying = true;
	}

	public async pause() {
		this.log.debug("playback paused");
		this.isPlaying = false;
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
}
