import { Grants } from "./permissions.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import { getLogger } from "../logger.js";
import winston from "winston";
import { AddRequest, ChatRequest, JoinRequest, LeaveRequest, OrderRequest, PlaybackRequest, RemoveRequest, RoomRequest, RoomRequestBase, RoomRequestType, SeekRequest, ServerMessage, ServerMessageSync, SkipRequest, UpdateUser } from "../common/models/messages";
import _ from "lodash";
import InfoExtract from "./infoextractor";
import usermanager from "../usermanager";
import { ClientInfo, QueueMode, Visibility, RoomOptions, RoomState, RoomUserInfo, Role, ClientId } from "../common/models/types";
import { User } from "../models/user";
import { Video, VideoId } from "../common/models/video";
import { VideoNotFoundException } from "./exceptions";
import dayjs, { Dayjs } from 'dayjs';
import { OmitTypes, PickFunctions, PickTypes } from "../common/typeutils.js";
import { NonNever, RequiredKeys } from "ts-essentials";
import { any } from "sequelize/types/lib/operators";

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

	async publishRoomEvent(request: RoomRequest, additional?: unknown): Promise<void> {
		const user = this.getUserInfo(request.client);
		await this.publish({
			action: "event",
			request,
			user,
			additional,
		});
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

		this.log.silly(`processing request: ${request.type}`);

		type RoomRequestHandlers = Omit<PickFunctions<Room, RoomRequestBase>, "processRequest">
		const handlers: Record<RoomRequestType, keyof RoomRequestHandlers | null> = {
			[RoomRequestType.JoinRequest]: "joinRoom",
			[RoomRequestType.LeaveRequest]: "leaveRoom",
			[RoomRequestType.PlaybackRequest]: "playback",
			[RoomRequestType.SkipRequest]: "skip",
			[RoomRequestType.SeekRequest]: "seek",
			[RoomRequestType.AddRequest]: "addToQueue",
			[RoomRequestType.RemoveRequest]: "removeFromQueue",
			[RoomRequestType.OrderRequest]: "reorderQueue",
			[RoomRequestType.VoteRequest]: null,
			[RoomRequestType.PromoteRequest]: null,
			[RoomRequestType.DemoteRequest]: null,
			[RoomRequestType.UpdateUser]: "updateUser",
			[RoomRequestType.ChatRequest]: "chat",
		};

		const handler = handlers[request.type];
		if (handler) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await this[handler](request as any);
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

	/**
	 * Play or pause the video, depending on the desired state. Handles PlaybackRequest.
	 */
	public async playback(request: PlaybackRequest): Promise<void> {
		if (request.state) {
			await this.play();
		}
		else {
			await this.pause();
		}
		await this.publishRoomEvent(request);
	}

	// eslint-disable-next-line no-unused-vars
	public async skip(request: SkipRequest): Promise<void> {
		const current = this.currentSource;
		this.dequeueNext();
		await this.publishRoomEvent(request, { video: current });
	}

	/**
	 * Seek to the specified position in the video.
	 * @param value
	 */
	public async seek(request: SeekRequest): Promise<void> {
		if (request.value === undefined) {
			this.log.error("seek value was undefined");
			return;
		}
		this.playbackPosition = request.value;
		await this.publishRoomEvent(request);
	}

	/**
	 * Add the video to the queue. Should only be called after permissions have been checked.
	 * @param request
	 */
	public async addToQueue(request: AddRequest): Promise<void> {
		if (request.url) {
			const adapter = InfoExtract.getServiceAdapterForURL(request.url);
			request.video = {} as VideoId;
			request.video.service = adapter.serviceId;
			request.video.id = adapter.getVideoId(request.url);
		}

		if (request.video) {
			const video: Video = await InfoExtract.getVideoInfo(request.video.service, request.video.id);
			this.queue.push(video);
			this.log.info(`Video added: ${JSON.stringify(request.video)}`);
			await this.publishRoomEvent(request, { video });
		}
		else if (request.videos) {
			const videos: Video[] = await InfoExtract.getManyVideoInfo(request.videos);
			this.queue.push(...videos);
			this.log.info(`added ${request.videos.length} videos`);
			await this.publishRoomEvent(request, { videos });
		}
		else {
			this.log.error("Invalid parameters for AddRequest");
			return;
		}

		this.markDirty("queue");
	}

	public async removeFromQueue(request: RemoveRequest): Promise<void> {
		const matchIdx = _.findIndex(this.queue, item => (item.service === request.video.service && item.id === request.video.id));
		if (matchIdx < 0) {
			throw new VideoNotFoundException();
		}
		// remove the item from the queue
		const removed = this.queue.splice(matchIdx, 1)[0];
		this.markDirty("queue");
		this.log.info(`Video removed: ${JSON.stringify(removed)}`);
		await this.publishRoomEvent(request, { video: removed });
	}

	public async reorderQueue(request: OrderRequest): Promise<void> {
		const video = this.queue.splice(request.fromIdx, 1)[0];
		this.queue.splice(request.toIdx, 0, video);
		this.markDirty("queue");
	}

	public async joinRoom(request: JoinRequest): Promise<void> {
		const user = new RoomUser(request.info.id);
		await user.updateInfo(request.info);
		this.realusers.push(user);
		this.markDirty("users");
		this.log.info(`${user.username} joined the room`);
		await this.publishRoomEvent(request);
	}

	public async leaveRoom(request: LeaveRequest): Promise<void> {
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === request.client) {
				this.realusers.splice(i--, 1);
				this.markDirty("users");
				break;
			}
		}
		await this.publishRoomEvent(request);
	}

	public async updateUser(request: UpdateUser): Promise<void> {
		this.log.debug(`User was updated: ${request.info.id} ${JSON.stringify(request.info)}`);
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === request.info.id) {
				this.realusers[i].updateInfo(request.info);
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
