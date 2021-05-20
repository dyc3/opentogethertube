import { Grants } from "./permissions.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import { getLogger } from "../logger.js";
import winston from "winston";
import { ServerMessageSync } from "./messages";
import _ from "lodash";
import { Video } from "../common/video";

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

	currentSource: Video | null = null
	queue: Video[] = []
	isPlaying: boolean = false
	playbackPosition: number = 0
	grants: Grants = new Grants();

	_dirty: Set<keyof RoomState> = new Set();
	log: winston.Logger

	constructor (options: RoomOptions) {
		Object.assign(this, options);
		this.log = getLogger(`room/${this.name}`);
	}

	public get name() {
		return this._name;
	}

	public set name(value: string) {
		this._name = value;
		this._dirty.add("name");
	}

	public get title() {
		return this._title;
	}

	public set title(value: string) {
		this._title = value;
		this._dirty.add("title");
	}

	public get description() {
		return this._description;
	}

	public set description(value: string) {
		this._description = value;
		this._dirty.add("description");
	}

	public get visibility() {
		return this._visibility;
	}

	public set visibility(value: Visibility) {
		this._visibility = value;
		this._dirty.add("visibility");
	}

	public get queueMode() {
		return this._queueMode;
	}

	public set queueMode(value: QueueMode) {
		this._queueMode = value;
		this._dirty.add("queueMode");
	}

	public async update() {
		this.log.info("updating");
		let state: RoomState = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "grants");
		await set(`room:${this.name}`, JSON.stringify(state));
	}

	public async sync() {
		if (this._dirty.size === 0) {
			return;
		}

		let msg: ServerMessageSync = {
			action: "sync",
		}

		let state: RoomState = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "grants");

		msg = Object.assign(msg, _.pick(state, Array.from(this._dirty)))

		await set(`room:${this.name}`, JSON.stringify(state));
		await publish(`room:${this.name}`, JSON.stringify(msg));
	}
}
