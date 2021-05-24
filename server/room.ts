import { Grants } from "./permissions.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import { getLogger } from "../logger.js";
import winston from "winston";
import { ChatRequest, JoinRequest, RoomRequest, RoomRequestType, ServerMessage, ServerMessageSync } from "../common/models/messages";
import _ from "lodash";
import InfoExtract from "./infoextractor";
import usermanager from "../usermanager";
import { ClientInfo, QueueMode, Visibility, RoomOptions, RoomState, RoomUserInfo, Role, ClientId } from "../common/models/types";
import { User } from "../models/user";
import { Video, VideoId } from "../common/models/video";
import { VideoNotFoundException } from "./exceptions";
import dayjs, { Dayjs } from 'dayjs';

const publish = promisify(redisClient.publish).bind(redisClient);
const set = promisify(redisClient.set).bind(redisClient);
const ROOM_UNLOAD_AFTER = 240; // seconds

/**
 * Represents a User from the Room's perspective.
 */
export class RoomUser {
	id: ClientId
	user_id?: number
	unregisteredUsername = ""
	user: User | null

	constructor(id: string) {
		this.id = id;
		this.user = null;
	}

	public get isLoggedIn(): boolean {
		return !!this.user_id;
	}

	public get username(): string {
		if (this.isLoggedIn && this.user) {
			return this.user.username;
		}
		else {
			return this.unregisteredUsername;
		}
	}

	public async updateInfo(info: ClientInfo): Promise<void> {
		if (info.user_id) {
			this.user_id = info.user_id;
			this.user = await usermanager.getUser({ id: info.user_id });
		}
		else if (info.username) {
			this.unregisteredUsername = info.username;
			this.user_id = undefined;
			this.user = null;
		}
	}
}

export class Room implements RoomState {
	_name = "";
	_title = "";
	_description = "";
	_visibility: Visibility = Visibility.Public;
	_queueMode: QueueMode = QueueMode.Manual;
	isTemporary = false;

	_currentSource: Video | null = null
	queue: Video[] = []
	_isPlaying = false
	_playbackPosition = 0
	grants: Grants = new Grants();
	realusers: RoomUser[] = []
	userRoles: Map<Role, Set<number>>
	owner: User | null

	_dirty: Set<keyof RoomState> = new Set();
	log: winston.Logger
	_playbackStart: Dayjs | null = null;
	_keepAlivePing: Dayjs

	constructor (options: RoomOptions) {
		this.log = getLogger(`room/${options.name}`);
		this.userRoles = new Map([
			[Role.TrustedUser, new Set()],
			[Role.Moderator, new Set()],
			[Role.Administrator, new Set()],
		]);
		this.owner = null;
		this._keepAlivePing = dayjs();

		Object.assign(this, _.pick(options, "name", "title", "description", "visibility", "queueMode", "isTemporary", "owner"));
		if (!(this.grants instanceof Grants)) {
			this.grants = new Grants(this.grants);
		}
		else if (this.grants instanceof Number) {
			this.grants = new Grants();
		}
	}

	public get name(): string {
		return this._name;
	}

	public set name(value: string) {
		this._name = value;
		this.markDirty("name");
	}

	public get title(): string {
		// if (this._title.length === 0 && this.isTemporary) {
		// 	return "Temporary Room";
		// }
		return this._title;
	}

	public set title(value: string) {
		this._title = value;
		this.markDirty("title");
	}

	public get description(): string {
		return this._description;
	}

	public set description(value: string) {
		this._description = value;
		this.markDirty("description");
	}

	public get visibility(): Visibility {
		return this._visibility;
	}

	public set visibility(value: Visibility) {
		this._visibility = value;
		this.markDirty("visibility");
	}

	public get queueMode(): QueueMode {
		return this._queueMode;
	}

	public set queueMode(value: QueueMode) {
		this._queueMode = value;
		this.markDirty("queueMode");
	}

	public get currentSource(): Video | null {
		return this._currentSource;
	}

	public set currentSource(value: Video | null) {
		this._currentSource = value;
		this.markDirty("currentSource");
	}

	public get isPlaying(): boolean {
		return this._isPlaying;
	}

	public set isPlaying(value: boolean) {
		this._isPlaying = value;
		this.markDirty("isPlaying");
	}

	public get playbackPosition(): number {
		return this._playbackPosition;
	}

	public set playbackPosition(value: number) {
		this._playbackPosition = value;
		this.markDirty("playbackPosition");
	}

	get users(): RoomUserInfo[] {
		const infos: RoomUserInfo[] = [];
		for (const user of this.realusers) {
			const info: RoomUserInfo = {
				id: user.id,
				name: user.username,
				isLoggedIn: user.isLoggedIn,
				status: "joined",
				role: this.getRole(user),
			};
			infos.push(info);
		}
		return infos;
	}

	markDirty(prop: keyof RoomState): void {
		this._dirty.add(prop);
		this.throttledSync();
	}

	dequeueNext(): void {
		if (this.queue.length > 0) {
			this.currentSource = this.queue.shift();
			this.markDirty("queue");
			this.playbackPosition = 0;
		}
		else if (this.currentSource !== null) {
			if (this.isPlaying) {
				this.isPlaying = false;
			}
			this.playbackPosition = 0;
			this.currentSource = null;
		}
	}

	/**
	 * Publish a message to the client manager. In general, these messages get sent to all the clients connected, and joined to this room. However, centain messages may be directed at a specific client, depending on what they do.
	 * @param msg The message to publish.
	 */
	async publish(msg: ServerMessage): Promise<void> {
		await publish(`room:${this.name}`, JSON.stringify(msg));
	}

	isOwner(user: RoomUser): boolean {
		return user.user && this.owner && user.user.id === this.owner.id;
	}

	getRole(user: RoomUser): Role {
		if (this.isOwner(user)) {
			return Role.Owner;
		}
		if (user.user) {
			for (let i = Role.Administrator; i >= Role.TrustedUser; i--) {
				if (this.userRoles.get(i).has(user.user.id)) {
					return i;
				}
			}
		}
		if (user.isLoggedIn) {
			return Role.RegisteredUser;
		}
		else {
			return Role.UnregisteredUser;
		}
	}

	getUser(client: ClientId): RoomUser {
		for (const user of this.realusers) {
			if (user.id === client) {
				return user;
			}
		}
	}

	getUserInfo(client: ClientId): RoomUserInfo {
		for (const user of this.users) {
			if (user.id === client) {
				return user;
			}
		}
	}

	public async update(): Promise<void> {
		if (this.currentSource === null) {
			this.dequeueNext();
		}

		if (this.users.length > 0) {
			this._keepAlivePing = dayjs();
		}
	}

	throttledSync = _.debounce(this.sync, 50, { trailing: true })

	public async sync(): Promise<void> {
		if (this._dirty.size === 0) {
			return;
		}

		this.log.debug(`synchronizing dirty props: ${Array.from(this._dirty)}`);

		let msg: ServerMessageSync = {
			action: "sync",
		};

		const state: RoomState = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "grants", "users");

		msg = Object.assign(msg, _.pick(state, Array.from(this._dirty)));

		// FIXME: permissions
		msg.grants = this.grants.getMask(Role.Owner);

		await set(`room:${this.name}`, JSON.stringify(state));
		await this.publish(msg);
		this._dirty.clear();
	}

	public async onBeforeUnload(): Promise<void> {
		await this.publish({ action: "unload" });
	}

	/**
	 * If true, the room is stale, and should be unloaded.
	 */
	get isStale(): boolean {
		const staleTime = dayjs().diff(this._keepAlivePing, "seconds");
		return staleTime > ROOM_UNLOAD_AFTER;
	}

	public async processRequest(request: RoomRequest): Promise<void> {
		const user = this.getUser(request.client);
		const permissions = new Map([
			[RoomRequestType.PlaybackRequest, "playback.play-pause"],
			[RoomRequestType.SkipRequest, "playback.skip"],
			[RoomRequestType.SeekRequest, "playback.seek"],
			[RoomRequestType.AddRequest, "manage-queue.add"],
			[RoomRequestType.RemoveRequest, "manage-queue.remove"],
			[RoomRequestType.OrderRequest, "manage-queue.order"],
			[RoomRequestType.VoteRequest, "manage-queue.vote"],
			[RoomRequestType.ChatRequest, "chat"],
		]);
		const permission = permissions.get(request.type);
		if (permission) {
			this.grants.check(this.getRole(user), permission);
		}

		const shouldEmitEvent = request.type !== RoomRequestType.VoteRequest && request.type !== RoomRequestType.UpdateUser && request.type !== RoomRequestType.ChatRequest;

		this.log.silly(`processing request: ${request.type}`);

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
			else if (request.url) {
				await this.addToQueue(request.url);
			}
			else if (request.videos) {
				this.log.warn("TODO: add many to queue");
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
		else if (request.type === RoomRequestType.LeaveRequest) {
			await this.leaveRoom(request.client);
		}
		else if (request.type === RoomRequestType.UpdateUser) {
			await this.updateUser(request.info);
		}
		else if (request.type === RoomRequestType.ChatRequest) {
			await this.chat(request);
		}
		else {
			this.log.error(`Unknown room request: ${(request as { type: RoomRequestType }).type}`);
			return;
		}

		if (shouldEmitEvent) {
			await this.publish({
				action: "event",
				request,
			});
		}
	}

	public async setGrants(grants: Grants): Promise<void> {
		this.grants.setAllGrants(grants);
	}

	public async play(): Promise<void> {
		if (this.isPlaying) {
			this.log.silly("already playing");
			return;
		}
		this.log.debug("playback started");
		this.isPlaying = true;
		this._playbackStart = dayjs();
	}

	public async pause(): Promise<void> {
		if (!this.isPlaying) {
			this.log.silly("already paused");
			return;
		}
		this.log.debug("playback paused");
		this.isPlaying = false;
		this.playbackPosition += dayjs().diff(this._playbackStart, "millisecond") / 1000;
		this._playbackStart = null;
	}

	public async skip(): Promise<void> {
		this.dequeueNext();
	}

	/**
	 * Seek to the specified position in the video.
	 * @param value
	 */
	public async seek(value: number): Promise<void> {
		if (value === undefined) {
			this.log.error("seek value was undefined");
			return;
		}
		this.playbackPosition = value;
	}

	/**
	 * Add the video to the queue. Should only be called after permissions have been checked.
	 * @param video
	 */
	public async addToQueue(video: VideoId | string): Promise<void> {
		const queueItem: VideoId = {
			service: "",
			id: "",
		};

		if (typeof video === "string") {
			const adapter = InfoExtract.getServiceAdapterForURL(video);
			queueItem.service = adapter.serviceId;
			queueItem.id = adapter.getVideoId(video);
		}
		else {
			queueItem.service = video.service;
			queueItem.id = video.id;
		}

		const videoComplete: Video = await InfoExtract.getVideoInfo(queueItem.service, queueItem.id);

		this.queue.push(videoComplete);
		this.markDirty("queue");
		this.log.info(`Video added: ${JSON.stringify(queueItem)}`);
	}

	public async removeFromQueue(video: VideoId): Promise<void> {
		const matchIdx = _.findIndex(this.queue, item => (item.service === video.service && item.id === video.id));
		if (matchIdx < 0) {
			throw new VideoNotFoundException();
		}
		// remove the item from the queue
		const removed = this.queue.splice(matchIdx, 1)[0];
		this.markDirty("queue");
		this.log.info(`Video removed: ${JSON.stringify(removed)}`);
		// if (session && client) {
		// 	this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.REMOVE_FROM_QUEUE, client.username, { video: removed, queueIdx: matchIdx }));
		// }
		// else {
		// 	this.log.warn("UNABLE TO SEND ROOM EVENT: Couldn't send room event removeFromQueue because no session information was provided.");
		// }
	}

	public async reorderQueue(from: number, to: number): Promise<void> {
		const video = this.queue.splice(from, 1)[0];
		this.queue.splice(to, 0, video);
		this.markDirty("queue");
	}

	public async joinRoom(request: JoinRequest): Promise<void> {
		const user = new RoomUser(request.info.id);
		await user.updateInfo(request.info);
		this.realusers.push(user);
		this.markDirty("users");
		this.log.info(`${user.username} joined the room`);
	}

	public async leaveRoom(id: string): Promise<void> {
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === id) {
				this.realusers.splice(i--, 1);
				this.markDirty("users");
				break;
			}
		}
	}

	public async updateUser(info: ClientInfo): Promise<void> {
		this.log.debug(`User was updated: ${info.id} ${JSON.stringify(info)}`);
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === info.id) {
				this.realusers[i].updateInfo(info);
				this.markDirty("users");
			}
		}
	}

	public async chat(request: ChatRequest): Promise<void> {
		const user = this.getUserInfo(request.client);
		await this.publish({
			action: "chat",
			from: user,
			text: request.text,
		});
	}
}
