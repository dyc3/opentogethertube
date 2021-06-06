import permissions, { Grants } from "./permissions.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import { getLogger } from "../logger.js";
import winston from "winston";
import { AddRequest, ApplySettingsRequest, ChatRequest, JoinRequest, LeaveRequest, OrderRequest, PlaybackRequest, PromoteRequest, RemoveRequest, RoomRequest, RoomRequestBase, RoomRequestType, SeekRequest, ServerMessage, ServerMessageSync, SkipRequest, UndoRequest, UpdateUser, VoteRequest } from "../common/models/messages";
import _ from "lodash";
import InfoExtract from "./infoextractor";
import usermanager from "../usermanager";
import { ClientInfo, QueueMode, Visibility, RoomOptions, RoomState, RoomUserInfo, Role, ClientId, PlayerStatus, RoomStateSyncable, RoomEventContext, RoomStateStorable, RoomSettings, AuthToken } from "../common/models/types";
import { User } from "../models/user";
import { Video, VideoId } from "../common/models/video";
import dayjs, { Dayjs } from 'dayjs';
import { PickFunctions } from "../common/typeutils";
import { replacer } from "../common/serialize";
import { ImpossiblePromotionException, OttException, VideoAlreadyQueuedException, VideoNotFoundException } from "./exceptions";
import storage from "./../storage";
import tokens from "./auth/tokens";

const publish = promisify(redisClient.publish).bind(redisClient);
const set = promisify(redisClient.set).bind(redisClient);
const ROOM_UNLOAD_AFTER = 240; // seconds

/**
 * Represents a User from the Room's perspective.
 */
export class RoomUser {
	id: ClientId
	token: AuthToken
	user_id?: number
	unregisteredUsername = ""
	user: User | null
	playerStatus: PlayerStatus = PlayerStatus.none

	constructor(id: ClientId) {
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
		if (info.status) {
			this.playerStatus = info.status;
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
	_owner: User | null = null
	grants: Grants = new Grants();
	userRoles: Map<Role, Set<number>>

	_currentSource: Video | null = null
	queue: Video[] = []
	_isPlaying = false
	_playbackPosition = 0
	realusers: RoomUser[] = []
	votes: Map<string, Set<ClientId>> = new Map();

	_dirty: Set<keyof RoomState> = new Set();
	log: winston.Logger
	_playbackStart: Dayjs | null = null;
	_keepAlivePing: Dayjs

	constructor (options: Partial<RoomOptions>) {
		this.log = getLogger(`room/${options.name}`);
		this.userRoles = new Map([
			[Role.TrustedUser, new Set()],
			[Role.Moderator, new Set()],
			[Role.Administrator, new Set()],
		]);
		this.owner = null;
		this._keepAlivePing = dayjs();

		Object.assign(this, _.pick(options, "name", "title", "description", "visibility", "queueMode", "isTemporary", "owner", "currentSource", "queue", "playbackPosition", "isPlaying"));
		if (options.grants instanceof Grants) {
			this.grants = options.grants;
		}
		else if (options.grants) {
			for (const rid in options.grants) {
				if (typeof rid === "string") {
					options.grants[parseInt(rid, 10)] = options.grants[rid];
				}
			}
			this.grants = new Grants(options.grants);
		}
		if (!(this.grants instanceof Grants)) {
			this.grants = new Grants(this.grants);
		}
		else if (this.grants instanceof Number) {
			this.grants = new Grants();
		}
		if (!this.grants) {
			this.grants = new Grants();
		}
		if (options.userRoles) {
			if (Array.isArray(options.userRoles)) {
				for (const [role, ids] of options.userRoles) {
					this.userRoles.set(role, new Set(ids));
				}
			}
			else {
				for (let role = Role.TrustedUser; role <= Role.Administrator; role++) {
					if (options.userRoles[role]) {
						this.userRoles.set(role, new Set(options.userRoles[role]));
					}
				}
			}
		}
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		if (options._playbackStart) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			this._playbackStart = dayjs(options._playbackStart);
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

	public get owner(): User | null {
		return this._owner;
	}

	public set owner(value: User | null) {
		this._owner = value;
		this.markDirty("hasOwner");
		this.markDirty("users");
	}

	get users(): RoomUserInfo[] {
		const infos: RoomUserInfo[] = [];
		for (const user of this.realusers) {
			const info: RoomUserInfo = {
				id: user.id,
				name: user.username,
				isLoggedIn: user.isLoggedIn,
				status: user.playerStatus,
				role: this.getRole(user),
			};
			infos.push(info);
		}
		return infos;
	}

	private markDirty(prop: keyof RoomState): void {
		this._dirty.add(prop);
		this.throttledSync();
	}

	dequeueNext(): void {
		this.log.debug(`dequeuing next video. mode: ${this.queueMode}`);
		if (this.currentSource !== null) {
			if (this.queueMode === QueueMode.Dj) {
				this.playbackPosition = 0;
				this._playbackStart = dayjs();
				return;
			}
			else if (this.queueMode === QueueMode.Loop) {
				this.queue.push(this.currentSource);
				this.markDirty("queue");
			}
		}
		if (this.queue.length > 0) {
			this.currentSource = this.queue.shift();
			this.markDirty("queue");
			this.playbackPosition = 0;
			this._playbackStart = dayjs();
		}
		else if (this.currentSource !== null) {
			if (this.isPlaying) {
				this.isPlaying = false;
			}
			this.playbackPosition = 0;
			this._playbackStart = dayjs();
			this.currentSource = null;
		}
	}

	/**
	 * Publish a message to the client manager. In general, these messages get sent to all the clients connected, and joined to this room. However, centain messages may be directed at a specific client, depending on what they do.
	 * @param msg The message to publish.
	 */
	async publish(msg: ServerMessage): Promise<void> {
		await publish(`room:${this.name}`, JSON.stringify(msg, replacer));
	}

	async publishRoomEvent(request: RoomRequest, additional?: RoomEventContext): Promise<void> {
		const user = this.getUserInfo(request.client);
		delete request.token;
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

	get hasOwner(): boolean {
		return !!this.owner;
	}

	getRole(user?: RoomUser): Role {
		if (!user) {
			return Role.UnregisteredUser;
		}
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

	async getRoleFromToken(token: AuthToken): Promise<Role> {
		const session = await tokens.getSessionInfo(token);
		if (session.user_id) {
			if (this.owner.id === session.user_id) {
				return Role.Owner;
			}
			for (let i = Role.Administrator; i >= Role.TrustedUser; i--) {
				if (this.userRoles.get(i).has(session.user_id)) {
					return i;
				}
			}
			return Role.RegisteredUser;
		}
		else {
			return Role.UnregisteredUser;
		}
	}

	getUser(client: ClientId): RoomUser | undefined {
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

	getClientId(token: AuthToken): ClientId {
		for (const user of this.realusers) {
			if (user.token === token) {
				return user.id;
			}
		}
	}

	get realPlaybackPosition(): number {
		if (this._playbackStart) {
			return this.playbackPosition + (dayjs().diff(this._playbackStart, "millisecond") / 1000);
		}
		else {
			return this.playbackPosition;
		}
	}

	get voteCounts(): Map<string, number> {
		const counts = new Map();
		for (const [vid, votes] of this.votes.entries()) {
			counts.set(vid, votes.size);
		}
		return counts;
	}

	public async update(): Promise<void> {
		if (this.currentSource === undefined) {
			this.currentSource = null; // sanity check
		}

		if ((this.currentSource === null && this.queue.length > 0) || (this.currentSource && this.isPlaying && this.realPlaybackPosition > this.currentSource.length)) {
			this.dequeueNext();
		}

		if (this.users.length > 0) {
			this._keepAlivePing = dayjs();
		}

		// sort queue according to queue mode
		if (this.queueMode === QueueMode.Vote) {
			const _oldOrder = _.clone(this.queue);
			this.queue = _.orderBy(this.queue, [
				video => {
					const votes = this.votes.get(video.service + video.id);
					return votes ? votes.size : 0;
				},
			], ["desc"]);
			if (this.queue.length > 0 && !this.queue.every((value, index) => _.isEqual(value, _oldOrder[index]))) {
				this.markDirty("queue");
			}
		}
	}

	throttledSync = _.debounce(this.sync, 50, { trailing: true })

	/**
	 * Serialize the room's state so that it can be stored in redis
	 */
	public serializeState(): string {
		const state: RoomStateStorable = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "grants", "userRoles", "owner", "_playbackStart");

		return JSON.stringify(state, replacer);
	}

	public serializeSyncableState(): string {
		const state: RoomStateSyncable = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "users", "grants", "hasOwner", "voteCounts");

		return JSON.stringify(state, replacer);
	}

	public async sync(): Promise<void> {
		if (this._dirty.size === 0) {
			return;
		}

		this.log.debug(`synchronizing dirty props: ${Array.from(this._dirty)}`);

		let msg: ServerMessageSync = {
			action: "sync",
		};

		const state: RoomStateSyncable = _.pick(this, "name", "title", "description", "isTemporary", "visibility", "queueMode", "currentSource", "queue", "isPlaying", "playbackPosition", "grants", "users", "voteCounts", "hasOwner");

		msg = Object.assign(msg, _.pick(state, Array.from(this._dirty)));
		await set(`room:${this.name}`, this.serializeState());
		await set(`room-sync:${this.name}`, this.serializeSyncableState());
		await this.publish(msg);

		let settings: Partial<Omit<RoomOptions, "name" | "isTemporary">> = _.pick(this, "title", "description", "visibility", "queueMode", "grants", "userRoles", "owner");
		settings = Object.assign({}, _.pick(settings, Array.from(this._dirty)));
		if (!_.isEmpty(settings)) {
			await storage.updateRoom({
				name: this.name,
				...settings,
			});
		}

		this._dirty.clear();
	}

	public async syncUser(info: RoomUserInfo): Promise<void> {
		this.log.debug(`syncing user: ${info.name}`);
		await this.publish({
			action: "user",
			user: {
				grants: this.grants.getMask(Role.Owner),
				...info,
			},
		});
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

	public isVideoInQueue(video: VideoId): boolean {
		if (this.currentSource && this.currentSource.service === video.service && this.currentSource.id === video.id) {
			return true;
		}
		const matchIdx = _.findIndex(this.queue, item => (item.service === video.service && item.id === video.id));
		if (matchIdx >= 0) {
			return true;
		}
		return false;
	}

	public async processRequest(request: RoomRequest): Promise<void> {
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
			this.grants.check(await this.getRoleFromToken(request.token), permission);
		}

		this.log.silly(`processing request: ${request.type}`);

		type RoomRequestHandlers = Omit<PickFunctions<Room, RoomRequestBase>, "processRequest" | "publishRoomEvent">
		const handlers: Record<RoomRequestType, keyof RoomRequestHandlers | null> = {
			[RoomRequestType.JoinRequest]: "joinRoom",
			[RoomRequestType.LeaveRequest]: "leaveRoom",
			[RoomRequestType.PlaybackRequest]: "playback",
			[RoomRequestType.SkipRequest]: "skip",
			[RoomRequestType.SeekRequest]: "seek",
			[RoomRequestType.AddRequest]: "addToQueue",
			[RoomRequestType.RemoveRequest]: "removeFromQueue",
			[RoomRequestType.OrderRequest]: "reorderQueue",
			[RoomRequestType.VoteRequest]: "vote",
			[RoomRequestType.PromoteRequest]: "promoteUser",
			[RoomRequestType.UpdateUser]: "updateUser",
			[RoomRequestType.ChatRequest]: "chat",
			[RoomRequestType.UndoRequest]: "undo",
			[RoomRequestType.ApplySettingsRequest]: "applySettings",
		};

		const handler = handlers[request.type];
		if (handler) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await this[handler](request as any);
		}
		else {
			this.log.error(`No room request handler: ${request.type}`);
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
		this.playbackPosition = this.realPlaybackPosition;
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

	public async skip(request: SkipRequest): Promise<void> {
		const current = this.currentSource;
		const prevPosition = this.realPlaybackPosition;
		this.dequeueNext();
		await this.publishRoomEvent(request, { video: current, prevPosition });
	}

	/**
	 * Seek to the specified position in the video.
	 * @param value
	 */
	public async seek(request: SeekRequest): Promise<void> {
		if (request.value === undefined || request.value === null) {
			this.log.error("seek value was undefined or null");
			return;
		}
		const prev = this.realPlaybackPosition;
		this.playbackPosition = request.value;
		this._playbackStart = dayjs();
		await this.publishRoomEvent(request, { prevPosition: prev });
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
			if (this.isVideoInQueue(request.video)) {
				throw new VideoAlreadyQueuedException();
			}

			const video: Video = await InfoExtract.getVideoInfo(request.video.service, request.video.id);
			if (video === undefined) {
				this.log.error("video was undefined, which is bad");
				throw new Error("video was undefined");
			}
			this.queue.push(video);
			this.log.info(`Video added: ${JSON.stringify(request.video)}`);
			await this.publishRoomEvent(request, { video });
		}
		else if (request.videos) {
			const videos: Video[] = await InfoExtract.getManyVideoInfo(request.videos);

			for (let i = 0; i < videos.length; i++) {
				const video = videos[i];
				if (video === undefined) {
					this.log.error("video was undefined, which is bad");
					throw new Error("video was undefined");
				}
				if (this.isVideoInQueue(video)) {
					videos.splice(i--, 1);
					continue;
				}
			}
			if (videos.length === 0) {
				throw new VideoAlreadyQueuedException();
			}

			this.queue.push(...videos);
			this.log.info(`added ${videos.length} videos`);
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
		await this.publishRoomEvent(request, { video: removed, queueIdx: matchIdx });
	}

	public async reorderQueue(request: OrderRequest): Promise<void> {
		const video = this.queue.splice(request.fromIdx, 1)[0];
		this.queue.splice(request.toIdx, 0, video);
		this.markDirty("queue");
	}

	public async joinRoom(request: JoinRequest): Promise<void> {
		const user = new RoomUser(request.info.id);
		user.token = request.token;
		await user.updateInfo(request.info);
		this.realusers.push(user);
		this.markDirty("users");
		this.log.info(`${user.username} joined the room`);
		await this.publishRoomEvent(request);
		await this.syncUser(this.getUserInfo(user.id));
		// HACK: force the client to receive the correct playback position
		await this.publish({ action: "sync", playbackPosition: this.realPlaybackPosition });
	}

	public async leaveRoom(request: LeaveRequest): Promise<void> {
		const removed = this.getUserInfo(request.client);
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === request.client) {
				this.realusers.splice(i--, 1);
				this.markDirty("users");
				break;
			}
		}
		await this.publishRoomEvent(request, { user: removed });
	}

	public async updateUser(request: UpdateUser): Promise<void> {
		this.log.debug(`User was updated: ${request.info.id} ${JSON.stringify(request.info)}`);
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === request.info.id) {
				this.realusers[i].updateInfo(request.info);
				this.markDirty("users");
				await this.syncUser(this.getUserInfo(this.realusers[i].id));
			}
		}
	}

	public async chat(request: ChatRequest): Promise<void> {
		const user = this.getUserInfo(this.getClientId(request.token));
		await this.publish({
			action: "chat",
			from: user,
			text: request.text,
		});
	}

	public async undo(request: UndoRequest): Promise<void> {
		switch (request.event.request.type) {
			case RoomRequestType.SeekRequest:
				await this.processRequest({
					type: request.event.request.type,
					client: request.client,
					value: request.event.additional.prevPosition,
				});
				break;
			case RoomRequestType.SkipRequest:
				if (this.currentSource) {
					this.queue.unshift(this.currentSource); // put current video back onto the top of the queue
					this.markDirty("queue");
				}
				this.currentSource = request.event.additional.video;
				this.playbackPosition = request.event.additional.prevPosition;
				break;
			case RoomRequestType.AddRequest:
				if (this.queue.length > 0) {
					const removeReq: RemoveRequest = {
						type: RoomRequestType.RemoveRequest,
						client: request.client,
						video: request.event.request.video,
					};
					await this.processRequest(removeReq);
				}
				else {
					this.currentSource = null;
				}
				break;
			case RoomRequestType.RemoveRequest:
				// eslint-disable-next-line no-case-declarations
				const newQueue = this.queue.splice(0, request.event.additional.queueIdx);
				newQueue.push(request.event.request.video);
				newQueue.push(...this.queue);
				this.queue = newQueue;
				this.markDirty("queue");
				break;
			default:
				this.log.error(`Event ${request.event.request.type} is not undoable, ignoring`);
				break;
		}
	}

	public async vote(request: VoteRequest): Promise<void> {
		const key = request.video.service + request.video.id;
		if (this.votes.has(key)) {
			const votes = this.votes.get(key);
			if (request.add) {
				votes.add(request.client);
			}
			else {
				votes.delete(request.client);
			}
		}
		else {
			if (request.add) {
				this.votes.set(key, new Set(request.client));
			}
			// TODO: throw exceptions for invalid votes instead of ignoring them
			// else {
			// 	throw new VoteNotFoundException();
			// }
		}
		this.markDirty("voteCounts");
	}

	public async promoteUser(request: PromoteRequest): Promise<void> {
		const user = this.getUser(request.client);
		const targetUser = this.getUser(request.targetClientId);
		this.log.info(`${user.username} is attempting to promote ${targetUser.username} to role ${request.role}`);

		let perm: string | undefined;
		switch (request.role) {
			case Role.Administrator:
				perm = "manage-users.promote-admin";
				break;
			case Role.Moderator:
				perm = "manage-users.promote-moderator";
				break;
			case Role.TrustedUser:
				perm = "manage-users.promote-trusted-user";
				break;
			default:
				break;
		}
		if (perm) {
			this.grants.check(this.getRole(user), perm);
		}
		const targetCurrentRole = this.getRole(targetUser);
		if (request.role < targetCurrentRole) {
			let demotePerm;
			switch (targetCurrentRole) {
				case Role.Administrator:
					demotePerm = "manage-users.demote-admin";
					break;
				case Role.Moderator:
					demotePerm = "manage-users.demote-moderator";
					break;
				case Role.TrustedUser:
					demotePerm = "manage-users.demote-trusted-user";
					break;
				default:
					this.log.error(`Can't demote ${permissions.ROLE_NAMES[targetCurrentRole]}`);
					throw new ImpossiblePromotionException();
			}
			this.grants.check(this.getRole(user), demotePerm);
		}

		if (targetCurrentRole === Role.UnregisteredUser) {
			throw new ImpossiblePromotionException();
		}
		for (let i = Role.Administrator; i >= Role.TrustedUser; i--) {
			const set = this.userRoles.get(i);
			if (set.has(targetUser.user_id)) {
				set.delete(targetUser.user_id);
			}
			this.userRoles[i] = Array.from(set);
		}
		if (request.role >= Role.TrustedUser) {
			this.userRoles.get(request.role).add(targetUser.user_id);
		}
		this.markDirty("users");
		await this.syncUser(this.getUserInfo(targetUser.id));
		if (!this.isTemporary) {
			try {
				await storage.updateRoom(this);
			}
			catch (err) {
				this.log.error(`Failed to update room: ${err} ${err.stack}`);
			}
		}
	}

	public async applySettings(request: ApplySettingsRequest): Promise<void> {
		const propsToPerms: Record<keyof Omit<RoomSettings, "grants">, string> = {
			"title": "configure-room.set-title",
			"description": "configure-room.set-description",
			"visibility": "configure-room.set-visibility",
			"queueMode": "configure-room.set-queue-mode",
		};
		const roleToPerms: Record<Exclude<Role, Role.Owner | Role.Administrator>, string> = {
			[Role.UnregisteredUser]: "configure-room.set-permissions.for-all-unregistered-users",
			[Role.RegisteredUser]: "configure-room.set-permissions.for-all-registered-users",
			[Role.TrustedUser]: "configure-room.set-permissions.for-trusted-users",
			[Role.Moderator]: "configure-room.set-permissions.for-moderator",
		};

		const user = this.getUser(request.client);
		const userrole = this.getRole(user);

		// TODO: have clients only send properties that they actually intend to change.
		// For now, we'll determine what the request is trying to change here, and delete the identical fields from the request.
		for (const prop in request.settings) {
			if (Object.prototype.hasOwnProperty.call(propsToPerms, prop)) {
				if (this[prop] === request.settings[prop]) {
					this.log.silly(`deleting ${prop} from request because it did not change`);
					delete request.settings[prop];
				}
			}
		}
		if (request.settings.grants) {
			for (const role in request.settings.grants.masks) {
				if (Object.hasOwnProperty.call(roleToPerms, role)) {
					if (request.settings.grants.masks[role] === this.grants.masks[role]) {
						this.log.silly(`deleting permissions for role ${role} from request because it did not change`);
						delete request.settings.grants.masks[role];
					}
				}
				else {
					this.log.silly(`deleting permissions for role ${role} from request because that role's permissions can't change`);
					delete request.settings.grants.masks[role];
				}
			}
			if (Object.keys(request.settings.grants.masks).length === 0) {
				this.log.silly(`deleting grants prop from request because it is empty`);
				delete request.settings.grants;
			}
		}

		// check permissions
		for (const prop in request.settings) {
			if (Object.prototype.hasOwnProperty.call(propsToPerms, prop)) {
				this.grants.check(userrole, propsToPerms[prop]);
			}
		}

		if (request.settings.grants) {
			const newGrants = request.settings.grants;
			for (const role in newGrants.masks) {
				if (Object.hasOwnProperty.call(roleToPerms, role)) {
					this.grants.check(userrole, roleToPerms[role]);
				}
			}
		}

		// Now that we've checked permissions, it's now safe to apply the settings.

		// apply the simple ones
		for (const prop in request.settings) {
			if (Object.prototype.hasOwnProperty.call(propsToPerms, prop)) {
				this[prop] = request.settings[prop];
			}
		}

		// special handling required for permissions
		if (request.settings.grants) {
			for (const role in request.settings.grants.masks) {
				if (Object.hasOwnProperty.call(roleToPerms, role)) {
					this.grants.setRoleGrants(role as unknown as Role, request.settings.grants.masks[role]);
				}
			}
		}
	}
}
