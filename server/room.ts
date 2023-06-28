import permissions, { GrantMask, Grants } from "../common/permissions";
import { redisClient } from "./redisclient";
import { promisify } from "util";
import { getLogger } from "./logger.js";
import winston from "winston";
import {
	AddRequest,
	ApplySettingsRequest,
	ChatRequest,
	JoinRequest,
	LeaveRequest,
	OrderRequest,
	PlaybackRequest,
	PromoteRequest,
	RemoveRequest,
	RoomRequest,
	RoomRequestBase,
	RoomRequestType,
	SeekRequest,
	ServerMessage,
	ServerMessageSync,
	SkipRequest,
	UndoRequest,
	UpdateUser,
	VoteRequest,
	PlayNowRequest,
	RoomRequestAuthorization,
	RoomRequestContext,
	ShuffleRequest,
	PlaybackSpeedRequest,
} from "../common/models/messages";
import _ from "lodash";
import InfoExtract from "./infoextractor";
import usermanager from "./usermanager";
import {
	ClientInfo,
	QueueMode,
	Visibility,
	RoomOptions,
	RoomUserInfo,
	Role,
	ClientId,
	PlayerStatus,
	RoomEventContext,
	RoomSettings,
	AuthToken,
} from "../common/models/types";
import { User } from "./models/user";
import type { QueueItem, Video, VideoId } from "../common/models/video";
import dayjs, { Dayjs } from "dayjs";
import type { PickFunctions } from "../common/typeutils";
import { replacer } from "../common/serialize";
import {
	ImpossiblePromotionException,
	VideoAlreadyQueuedException,
	VideoNotFoundException,
} from "./exceptions";
import storage from "./storage";
import tokens, { SessionInfo } from "./auth/tokens";
import { OttException } from "../common/exceptions";
import { getSponsorBlock } from "./sponsorblock";
import { ResponseError as SponsorblockResponseError, Segment } from "sponsorblock-api";
import { VideoQueue } from "./videoqueue";
import { Counter } from "prom-client";
import roommanager from "./roommanager";
import { calculateCurrentPosition } from "../common/timestamp";

const set = promisify(redisClient.set).bind(redisClient);
const ROOM_UNLOAD_AFTER = 240; // seconds

/**
 * Represents a User from the Room's perspective.
 */
export class RoomUser {
	id: ClientId;
	token: AuthToken;
	user_id?: number;
	unregisteredUsername = "";
	user: User | null;
	playerStatus: PlayerStatus = PlayerStatus.none;

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
		} else {
			return this.unregisteredUsername;
		}
	}

	public async updateInfo(info: ClientInfo): Promise<void> {
		if (info.user_id) {
			this.user_id = info.user_id;
			this.user = await usermanager.getUser({ id: info.user_id });
		} else if (info.username) {
			this.unregisteredUsername = info.username;
			this.user_id = undefined;
			this.user = null;
		}
		if (info.status) {
			this.playerStatus = info.status;
		}
	}
}

/**
 * Things that Rooms need to remember, but can safely be forgotten when the room is unloaded.
 * This rule does not necessarily apply to inherited fields.
 */
export interface RoomState extends RoomOptions, RoomStateComputed {
	currentSource: Video | null;
	queue: VideoQueue;
	isPlaying: boolean;
	playbackPosition: number;
	playbackSpeed: number;
	users: RoomUserInfo[];
	votes: Map<string, Set<ClientId>>;
	videoSegments: Segment[];
}

export type RoomStateFromRedis = Omit<RoomState, "userRoles" | "grants"> & {
	grants: [Role, GrantMask][];
	userRoles: [Role, number[]][];
};

export interface RoomStateComputed {
	hasOwner: boolean;
	voteCounts: Map<string, number>;
}

// Only these should be sent to clients, all others should be considered unsafe
export type RoomStateSyncable = Omit<RoomState, "owner" | "votes" | "userRoles" | "users">;

// Only these should be stored in redis
export type RoomStateStorable = Omit<RoomState, "hasOwner" | "votes" | "voteCounts" | "users">;

/** Only these should be stored in persistent storage */
export type RoomStatePersistable = Omit<
	RoomState,
	| "isTemporary"
	| "currentSource"
	| "queue"
	| "isPlaying"
	| "playbackPosition"
	| "playbackSpeed"
	| "users"
	| "votes"
	| "videoSegments"
	| "hasOwner"
	| "voteCounts"
>;

export class Room implements RoomState {
	_name = "";
	_title = "";
	_description = "";
	_visibility: Visibility = Visibility.Unlisted;
	_queueMode: QueueMode = QueueMode.Manual;
	isTemporary = false;
	_owner: User | null = null;
	grants: Grants = new Grants();
	userRoles: Map<Role, Set<number>>;
	_autoSkipSegments = true;

	_currentSource: QueueItem | null = null;
	queue: VideoQueue;
	prevQueue: QueueItem[] | null = null;
	_isPlaying = false;
	_playbackPosition = 0;
	_playbackSpeed = 1;
	realusers: RoomUser[] = [];
	/**
	 * Map of videos in the format service + id to a set of client votes.
	 */
	votes: Map<string, Set<ClientId>> = new Map();
	_videoSegments: Segment[] = [];

	_dirty: Set<keyof RoomStateSyncable> = new Set();
	log: winston.Logger;
	_playbackStart: Dayjs | null = null;
	_keepAlivePing: Dayjs;
	/**
	 * Used to defer grabbing sponsorblock segments to keep video dequeueing from blocking.
	 */
	wantSponsorBlock = false;
	dontSkipSegmentsUntil: number | null = null;

	constructor(options: Partial<RoomOptions>) {
		this.log = getLogger(`room/${options.name}`);
		this.queue = new VideoQueue();
		this.userRoles = new Map([
			[Role.TrustedUser, new Set()],
			[Role.Moderator, new Set()],
			[Role.Administrator, new Set()],
		]);
		this.owner = null;
		this._keepAlivePing = dayjs();

		Object.assign(
			this,
			_.pick(
				options,
				"name",
				"title",
				"description",
				"visibility",
				"queueMode",
				"isTemporary",
				"owner",
				"currentSource",
				"queue",
				"playbackPosition",
				"isPlaying",
				"playbackSpeed",
				"autoSkipSegments",
				"prevQueue"
			)
		);
		if (Array.isArray(this.queue)) {
			this.queue = new VideoQueue(this.queue);
		}
		if (options.grants instanceof Grants) {
			this.grants = options.grants;
		} else if (options.grants) {
			this.grants = new Grants(options.grants);
		}
		if (!(this.grants instanceof Grants)) {
			this.grants = new Grants(this.grants);
		} else if (this.grants instanceof Number) {
			this.grants = new Grants();
		}
		if (!this.grants) {
			this.grants = new Grants();
		}
		if (options.userRoles) {
			if (options.userRoles instanceof Map) {
				this.userRoles = options.userRoles;
			} else {
				this.log.warn("userRoles was not an instance of Map");
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

		this.queue.onDirty(() => this.markDirty("queue"));
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

	public get autoSkipSegments(): boolean {
		return this._autoSkipSegments;
	}

	public set autoSkipSegments(value: boolean) {
		this._autoSkipSegments = value;
		this.markDirty("autoSkipSegments");
	}

	public get currentSource(): QueueItem | null {
		return this._currentSource;
	}

	public set currentSource(value: QueueItem | null) {
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

	public get playbackSpeed(): number {
		return this._playbackSpeed;
	}

	public set playbackSpeed(value: number) {
		this._playbackSpeed = value;
		this.markDirty("playbackSpeed");
	}

	public get owner(): User | null {
		return this._owner;
	}

	public set owner(value: User | null) {
		this._owner = value;
		this.markDirty("hasOwner");
	}

	public get videoSegments(): Segment[] {
		return this._videoSegments;
	}

	public set videoSegments(value: Segment[]) {
		this._videoSegments = value;
		this.markDirty("videoSegments");
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

	private markDirty(prop: keyof RoomStateSyncable): void {
		this._dirty.add(prop);
		this.throttledSync();
	}

	private cleanDirty() {
		this._dirty.clear();
		this.queue.clean();
	}

	async dequeueNext() {
		this.log.debug(`dequeuing next video. mode: ${this.queueMode}`);
		if (this.currentSource !== null) {
			counterSecondsWatched
				.labels({ service: this.currentSource.service })
				.inc(this.calcDurationFromPlaybackStart());
			if (this.queueMode === QueueMode.Dj) {
				this.log.debug(`queue in dj mode, restarting current item`);
				this.playbackPosition = this.currentSource?.startAt ?? 0;
				this._playbackStart = dayjs();
				return;
			} else if (this.queueMode === QueueMode.Loop) {
				this.log.debug(`queue in loop mode, requeuing current item`);
				await this.queue.enqueue(this.currentSource);
			}
		}
		if (this.queue.length > 0) {
			this.log.debug(`queue has items in it, dequeuing`);

			this.currentSource = (await this.queue.dequeue()) ?? null;
			this.playbackPosition = this.currentSource?.startAt ?? 0;
			this._playbackStart = dayjs();
			if (this.videoSegments.length > 0) {
				this.videoSegments = [];
			}
		} else if (this.currentSource !== null) {
			this.log.debug(`queue is empty, but currentSource is not, clearing currentSource`);
			if (this.isPlaying) {
				this.isPlaying = false;
			}
			this.playbackPosition = 0;
			this._playbackStart = dayjs();
			this.currentSource = null;
		}

		if (this.autoSkipSegments && this.currentSource) {
			this.wantSponsorBlock = true;
		}
		if (!this.currentSource && this.videoSegments.length > 0) {
			this.videoSegments = [];
		}
		this.playbackSpeed = 1;

		this.log.debug(`Dirty props: ${Array.from(this._dirty)}`);
	}

	/**
	 * Publish a message to the client manager. In general, these messages get sent to all the clients connected, and joined to this room. However, centain messages may be directed at a specific client, depending on what they do.
	 * @param msg The message to publish.
	 */
	async publish(msg: ServerMessage): Promise<void> {
		roommanager.publish(this.name, msg);
	}

	async publishRoomEvent(
		request: RoomRequest,
		context: RoomRequestContext,
		additional?: RoomEventContext
	): Promise<void> {
		if (context.clientId === undefined) {
			this.log.warn("context.clientId was undefined, not publishing event");
			return;
		}
		const user = this.getUserInfo(context.clientId);
		await this.publish({
			action: "event",
			request,
			user,
			additional: additional ?? {},
		});
	}

	isOwner(user: RoomUser): boolean {
		return !!user.user && !!this.owner && user.user.id === this.owner.id;
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
				if (this.userRoles.get(i)?.has(user.user.id)) {
					return i;
				}
			}
		}
		if (user.isLoggedIn) {
			return Role.RegisteredUser;
		} else {
			return Role.UnregisteredUser;
		}
	}

	async getRoleFromToken(token: AuthToken): Promise<Role> {
		const session = await tokens.getSessionInfo(token);
		return this.getRoleFromSession(session);
	}

	getRoleFromSession(session: SessionInfo): Role {
		if (session && "user_id" in session) {
			if (this.owner && this.owner.id === session.user_id) {
				return Role.Owner;
			}
			for (let i = Role.Administrator; i >= Role.TrustedUser; i--) {
				if (this.userRoles.get(i)?.has(session.user_id)) {
					return i;
				}
			}
			return Role.RegisteredUser;
		} else {
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

	getUserFromToken(token: AuthToken): RoomUser | undefined {
		for (const user of this.realusers) {
			if (user.token === token) {
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
		throw new Error("Client not found");
	}

	async getUserInfoFromToken(
		token: AuthToken
	): Promise<Pick<RoomUserInfo, "name" | "isLoggedIn">> {
		if (!token) {
			throw new Error("token is a required parameter.");
		}
		const session: SessionInfo = await tokens.getSessionInfo(token);
		if (!session) {
			this.log.error("Session info for auth token was not found.");
			throw new Error("Session info not found.");
		}
		if (session.isLoggedIn) {
			const user = await usermanager.getUser({ id: session.user_id });
			return {
				name: user.username,
				isLoggedIn: true,
			};
		} else {
			return {
				name: session.username,
				isLoggedIn: false,
			};
		}
	}

	getClientId(token: AuthToken): ClientId {
		for (const user of this.realusers) {
			if (user.token === token) {
				return user.id;
			}
		}
		throw new Error("Client not found");
	}

	/** Get how much time (in seconds) has elapsed, in terms of where the playback head should be, since playback started. Returns 0 if the media is not playing. */
	calcDurationFromPlaybackStart(): number {
		if (this._playbackStart !== null) {
			return calculateCurrentPosition(this._playbackStart, dayjs(), 0, this.playbackSpeed);
		} else {
			return 0;
		}
	}

	get realPlaybackPosition(): number {
		if (this._playbackStart && this.isPlaying) {
			return this.playbackPosition + this.calcDurationFromPlaybackStart();
		} else {
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

		if (
			(this.currentSource === null && this.queue.length > 0) ||
			(this.currentSource &&
				this.isPlaying &&
				this.realPlaybackPosition >
					(this.currentSource.endAt ?? this.currentSource.length ?? 0))
		) {
			if (
				this.currentSource &&
				this.isPlaying &&
				this.realPlaybackPosition >
					(this.currentSource.endAt ?? this.currentSource.length ?? 0)
			) {
				counterMediaWatched.labels({ service: this.currentSource.service }).inc();
			}
			await this.dequeueNext();
		}

		if (this.users.length > 0) {
			this._keepAlivePing = dayjs();
		}

		// sort queue according to queue mode
		if (this.queueMode === QueueMode.Vote) {
			await this.queue.orderBy(
				[
					video => {
						const votes = this.votes.get(video.service + video.id);
						return votes ? votes.size : 0;
					},
				],
				["desc"]
			);
		}

		if (this.autoSkipSegments) {
			if (this.wantSponsorBlock) {
				this.wantSponsorBlock = false; // Disable this before the request to avoid spamming the sponsorblock if the request takes too long.
				try {
					await this.fetchSponsorBlockSegments();
				} catch (e) {
					if (e instanceof SponsorblockResponseError) {
						if (e.status === 429) {
							this.log.error(`Request to sponsorblock was ratelimited. ${e.message}`);
						} else if (e.status === 404) {
							this.log.debug("No sponsorblock segments available for this video.");
						} else {
							this.log.error(
								`Failed to grab sponsorblock segments: ${e.name} ${e.status} ${e.message}`
							);
						}
					} else {
						this.log.error(`Failed to grab sponsorblock segments`);
					}
				}
			}

			if (
				this.dontSkipSegmentsUntil &&
				this.realPlaybackPosition >= this.dontSkipSegmentsUntil
			) {
				this.dontSkipSegmentsUntil = null;
			}

			if (
				this.isPlaying &&
				this.videoSegments.length > 0 &&
				this.dontSkipSegmentsUntil === null
			) {
				const segment = this.getSegmentForTime(this.realPlaybackPosition);
				if (segment) {
					this.log.silly(`Segment ${segment.category} is now playing, skipping`);
					this.seekRaw(segment.endTime);
					await this.publish({
						action: "eventcustom",
						text: `Skipped ${segment.category}`,
					});
				}
			}
		}
	}

	throttledSync = _.debounce(this.sync, 50, { trailing: true });

	/**
	 * Serialize the room's state so that it can be stored in redis
	 */
	public serializeState(): string {
		const state: RoomStateStorable = _.pick(
			this,
			"name",
			"title",
			"description",
			"isTemporary",
			"visibility",
			"queueMode",
			"currentSource",
			"queue",
			"isPlaying",
			"playbackPosition",
			"playbackSpeed",
			"grants",
			"userRoles",
			"owner",
			"_playbackStart",
			"videoSegments",
			"autoSkipSegments",
			"prevQueue"
		);

		return JSON.stringify(state, replacer);
	}

	public serializeSyncableState(): string {
		const state: RoomStateSyncable = _.pick(
			this,
			"name",
			"title",
			"description",
			"isTemporary",
			"visibility",
			"queueMode",
			"currentSource",
			"queue",
			"isPlaying",
			"playbackPosition",
			"playbackSpeed",
			"users",
			"grants",
			"hasOwner",
			"voteCounts",
			"videoSegments",
			"autoSkipSegments",
			"prevQueue"
		);

		return JSON.stringify(state, replacer);
	}

	public async sync(): Promise<void> {
		if (this._dirty.size === 0) {
			return;
		}

		this.log.debug(`synchronizing dirty props: ${Array.from(this._dirty).toString()}`);

		let msg: ServerMessageSync = {
			action: "sync",
		};

		const state: RoomStateSyncable = _.pick(
			this,
			"name",
			"title",
			"description",
			"isTemporary",
			"visibility",
			"queueMode",
			"currentSource",
			"queue",
			"isPlaying",
			"playbackPosition",
			"playbackSpeed",
			"grants",
			"voteCounts",
			"hasOwner",
			"videoSegments",
			"autoSkipSegments",
			"prevQueue"
		);

		msg = Object.assign(msg, _.pick(state, Array.from(this._dirty)));
		await set(`room:${this.name}`, this.serializeState());
		await set(`room-sync:${this.name}`, this.serializeSyncableState());
		await this.publish(msg);

		let settings: Partial<RoomStatePersistable> = _.pick(
			this,
			"name",
			"title",
			"description",
			"visibility",
			"queueMode",
			"autoSkipSegments",
			"grants",
			"userRoles",
			"owner",
			"prevQueue"
		);
		if (!_.isEmpty(settings)) {
			await storage.updateRoom({
				...settings,
			});
		}

		this.cleanDirty();
	}

	public async syncUser(info: RoomUserInfo): Promise<void> {
		this.log.debug(`syncing user: ${info.name}`);
		await this.publish({
			action: "user",
			update: {
				kind: "update",
				value: info,
			},
		});
	}

	public async onBeforeUnload(): Promise<void> {
		if (!this.isTemporary) {
			const prevQueue = this.queue.items;
			if (this.currentSource) {
				prevQueue.unshift({
					...this.currentSource,
					startAt: this.realPlaybackPosition,
				});
			}

			await storage.updateRoom({
				name: this.name,
				prevQueue: prevQueue.length > 0 ? prevQueue : null,
			});
		}
	}

	/**
	 * If true, the room is stale, and should be unloaded.
	 */
	get isStale(): boolean {
		const staleTime = dayjs().diff(this._keepAlivePing, "seconds");
		return staleTime > ROOM_UNLOAD_AFTER;
	}

	public isVideoInQueue(video: VideoId): boolean {
		if (
			this.currentSource &&
			this.currentSource.service === video.service &&
			this.currentSource.id === video.id
		) {
			return true;
		}
		return this.queue.contains(video);
	}

	/**
	 * Grabs video segments from Sponsorblock for the current video.
	 */
	async fetchSponsorBlockSegments(): Promise<void> {
		if (!this.currentSource || this.currentSource.service !== "youtube") {
			if (this.videoSegments.length > 0) {
				this.videoSegments = [];
			}
			return;
		}
		this.log.info(
			`fetching sponsorblock segments for ${this.currentSource.service}:${this.currentSource.id}`
		);
		const sponsorBlock = await getSponsorBlock();
		this.videoSegments = await sponsorBlock.getSegments(this.currentSource.id, [
			"sponsor",
			"intro",
			"outro",
			"interaction",
			"selfpromo",
			"preview",
		]);
	}

	/** Updates playbackPosition according to the computed value, and resets _playbackStart */
	flushPlaybackPosition(): void {
		counterSecondsWatched
			.labels({ service: this.currentSource?.service })
			.inc(this.calcDurationFromPlaybackStart());
		this.playbackPosition = this.realPlaybackPosition;
		this._playbackStart = dayjs();
	}

	getSegmentForTime(time: number): Segment | undefined {
		for (const segment of this.videoSegments) {
			if (time >= segment.startTime && time <= segment.endTime) {
				return segment;
			}
		}
	}

	public async deriveRequestContext(
		authorization: RoomRequestAuthorization,
		request: RoomRequest
	): Promise<RoomRequestContext> {
		for (const user of this.realusers) {
			if (user.token === authorization.token) {
				return {
					username: user.username,
					role: await this.getRoleFromToken(authorization.token),
					clientId: user.id,
				};
			}
		}

		let session = await tokens.getSessionInfo(authorization.token);
		if (!session) {
			throw new Error("Invalid token, unauthorized request");
		}

		return {
			username: session.username,
			role: this.getRoleFromSession(session),
			// we don't have the client id for join requests because the info hasn't been added to the room yet
			clientId: request.type === RoomRequestType.JoinRequest ? request.info.id : undefined,
		};
	}

	public async processUnauthorizedRequest(
		request: RoomRequest,
		authorization: RoomRequestAuthorization
	): Promise<void> {
		await this.processRequest(request, await this.deriveRequestContext(authorization, request));
	}

	/** Process the room request, but unsafely trust the client id of the room request */
	public async processRequestUnsafe(request: RoomRequest, clientid: ClientId): Promise<void> {
		let userInfo = this.getUserInfo(clientid);
		await this.processRequest(request, {
			username: userInfo.name,
			role: userInfo.role,
			clientId: clientid,
		});
	}

	public async processRequest(request: RoomRequest, context: RoomRequestContext): Promise<void> {
		counterRoomRequests.inc();
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
			this.grants.check(context.role, permission);
		}

		this.log.debug(
			`processing request: ${request.type} for ${context.username} (client: ${context.clientId})`
		);

		type RoomRequestHandlers = Omit<
			PickFunctions<Room, RoomRequestBase, RoomRequestContext>,
			"processRequest" | "publishRoomEvent"
		>;
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
			[RoomRequestType.PlayNowRequest]: "playNow",
			[RoomRequestType.ShuffleRequest]: "shuffle",
			[RoomRequestType.PlaybackSpeedRequest]: "setPlaybackSpeed",
		};

		const handler = handlers[request.type];
		if (handler) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await this[handler](request as any, context);
		} else {
			this.log.error(`No room request handler: ${request.type}`);
		}
	}

	public getGrantsForUser(id: ClientId): GrantMask {
		const user = this.getUser(id);
		if (!user) {
			return 0;
		}
		return this.grants.getMask(this.getRole(user));
	}

	public async setGrants(grants: Grants): Promise<void> {
		this.grants.setAllGrants(grants);
		this.markDirty("grants");
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
		this.flushPlaybackPosition();
		this._playbackStart = null;
		this.isPlaying = false;
	}

	/**
	 * Play or pause the video, depending on the desired state. Handles PlaybackRequest.
	 */
	public async playback(request: PlaybackRequest, context: RoomRequestContext): Promise<void> {
		if (request.state) {
			await this.play();
		} else {
			await this.pause();
		}
		await this.publishRoomEvent(request, context);
	}

	public async skip(request: SkipRequest, context: RoomRequestContext): Promise<void> {
		if (!this.currentSource) {
			return;
		}
		const current = this.currentSource;
		const prevPosition = this.realPlaybackPosition;
		counterMediaSkipped.labels({ service: this.currentSource.service }).inc();
		this.dequeueNext();
		await this.publishRoomEvent(request, context, { video: current, prevPosition });
		this.videoSegments = [];
	}

	/**
	 * Seek to the specified position in the video. This does the bare minimum to maintain state and record metrics.
	 */
	private seekRaw(value: number): void {
		counterSecondsWatched
			.labels({ service: this.currentSource?.service })
			.inc(this.calcDurationFromPlaybackStart());
		this.playbackPosition = value;
		this._playbackStart = dayjs();
	}

	/**
	 * Seek to the specified position in the video.
	 */
	public async seek(request: SeekRequest, context: RoomRequestContext): Promise<void> {
		if (request.value === undefined || request.value === null) {
			this.log.error("seek value was undefined or null");
			return;
		}
		const prev = this.realPlaybackPosition;
		this.seekRaw(request.value);
		await this.publishRoomEvent(request, context, { prevPosition: prev });

		const segment = this.getSegmentForTime(this.playbackPosition);
		if (segment !== undefined) {
			this.dontSkipSegmentsUntil = segment.endTime;
		} else {
			this.dontSkipSegmentsUntil = null;
		}
	}

	/**
	 * Add the video to the queue. Should only be called after permissions have been checked.
	 * @param request
	 */
	public async addToQueue(request: AddRequest, context: RoomRequestContext): Promise<void> {
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

			const video: Video = await InfoExtract.getVideoInfo(
				request.video.service,
				request.video.id
			);
			if (video === undefined) {
				this.log.error("video was undefined, which is bad");
				throw new Error("video was undefined");
			}
			this.queue.enqueue(video);
			this.log.info(`Video added: ${JSON.stringify(request.video)}`);
			await this.publishRoomEvent(request, context, { video });
			counterMediaQueued.labels({ service: video.service }).inc();
		} else if (request.videos) {
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

			this.queue.enqueue(...videos);
			this.log.info(`added ${videos.length} videos`);
			await this.publishRoomEvent(request, context, { videos });
			for (let vid of videos) {
				counterMediaQueued.labels({ service: vid.service }).inc();
			}
		} else {
			this.log.error("Invalid parameters for AddRequest");
			return;
		}
	}

	public async removeFromQueue(
		request: RemoveRequest,
		context: RoomRequestContext
	): Promise<void> {
		if (!this.queue.contains(request.video)) {
			throw new VideoNotFoundException();
		}
		// remove the item from the queue
		const [matchIdx, removed] = await this.queue.evict(request.video);
		this.log.info(`Video removed: ${JSON.stringify(removed)}`);
		await this.publishRoomEvent(request, context, { video: removed, queueIdx: matchIdx });
	}

	public async reorderQueue(request: OrderRequest, context: RoomRequestContext): Promise<void> {
		await this.queue.move(request.fromIdx, request.toIdx);
	}

	public async joinRoom(request: JoinRequest, context: RoomRequestContext): Promise<void> {
		const user = new RoomUser(request.info.id);
		user.token = request.token;
		await user.updateInfo(request.info);
		this.realusers.push(user);
		this.log.info(`${user.username} joined the room`);
		await this.publishRoomEvent(request, context);
		// HACK: force the client to receive the correct playback position
		await this.publish({ action: "sync", playbackPosition: this.realPlaybackPosition });
	}

	public async leaveRoom(request: LeaveRequest, context: RoomRequestContext): Promise<void> {
		if (context.clientId === undefined) {
			throw new Error("context.clientId was undefined");
		}
		const removed = this.getUserInfo(context.clientId);
		// We must publish the event before removing the user, otherwise publishing the event will fail because the user is gone.
		await this.publishRoomEvent(request, context, { user: removed });

		if (this.queueMode === QueueMode.Vote) {
			this.log.debug(`removing votes for leaving client ${context.clientId}`);
			this.votes.forEach(value => {
				if (value.delete(removed.id)) {
					this.markDirty("voteCounts");
				}
			});
		}
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === context.clientId) {
				this.realusers.splice(i--, 1);
				// sending the user update to remove the user is handled by clientmanager
				break;
			}
		}
	}

	public async updateUser(request: UpdateUser, context: RoomRequestContext): Promise<void> {
		this.log.debug(`User was updated: ${request.info.id} ${JSON.stringify(request.info)}`);
		for (let i = 0; i < this.realusers.length; i++) {
			if (this.realusers[i].id === request.info.id) {
				await this.realusers[i].updateInfo(request.info);
				await this.syncUser(this.getUserInfo(this.realusers[i].id));
				break;
			}
		}
	}

	public async chat(request: ChatRequest, context: RoomRequestContext): Promise<void> {
		if (context.clientId === undefined) {
			throw new Error("context.clientId was undefined");
		}
		const user = this.getUserInfo(context.clientId);
		await this.publish({
			action: "chat",
			from: user,
			text: request.text,
		});
	}

	public async undo(request: UndoRequest, context: RoomRequestContext): Promise<void> {
		// FIXME: room event type definitions suck ass, and needs to be reworked
		switch (request.event.request.type) {
			case RoomRequestType.SeekRequest:
				if (request.event.additional.prevPosition) {
					await this.processRequest(
						{
							type: request.event.request.type,
							value: request.event.additional.prevPosition,
						},
						context
					);
				}
				break;
			case RoomRequestType.SkipRequest:
				if (this.currentSource) {
					this.queue.pushTop(this.currentSource);
				}
				if (request.event.additional.video && request.event.additional.prevPosition) {
					this.currentSource = request.event.additional.video;
					this.playbackPosition = request.event.additional.prevPosition;
				}
				break;
			case RoomRequestType.AddRequest:
				if (this.queue.length > 0 && request.event.request.video) {
					const removeReq: RemoveRequest = {
						type: RoomRequestType.RemoveRequest,
						video: request.event.request.video,
					};
					await this.processRequest(removeReq, context);
				} else {
					this.currentSource = null;
				}
				break;
			case RoomRequestType.RemoveRequest:
				if (
					request.event.additional.video &&
					request.event.additional.queueIdx !== undefined
				) {
					this.queue.insert(
						request.event.additional.video,
						request.event.additional.queueIdx
					);
				}
				break;
			default:
				this.log.error(`Event ${request.event.request.type} is not undoable, ignoring`);
				break;
		}
	}

	public async vote(request: VoteRequest, context: RoomRequestContext): Promise<void> {
		if (!context.clientId) {
			throw new OttException("Can't vote if not connected to room.");
		}
		const key = request.video.service + request.video.id;
		if (this.votes.has(key)) {
			const votes = this.votes.get(key)!;
			if (request.add) {
				votes.add(context.clientId);
			} else {
				votes.delete(context.clientId);
			}
		} else {
			if (request.add) {
				this.votes.set(key, new Set([context.clientId]));
			}
			// TODO: throw exceptions for invalid votes instead of ignoring them
			// else {
			// 	throw new VoteNotFoundException();
			// }
		}
		this.markDirty("voteCounts");
	}

	public async promoteUser(request: PromoteRequest, context: RoomRequestContext): Promise<void> {
		const targetUser = this.getUser(request.targetClientId);
		if (!targetUser) {
			throw new OttException("Client not found.");
		}
		this.log.info(
			`${context.username} is attempting to promote ${targetUser.username} to role ${request.role}`
		);

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
			this.grants.check(context.role, perm);
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
			this.grants.check(context.role, demotePerm);
		}

		if (targetCurrentRole === Role.UnregisteredUser) {
			throw new ImpossiblePromotionException();
		}
		if (targetUser.user_id !== undefined) {
			for (let i = Role.Administrator; i >= Role.TrustedUser; i--) {
				const set = this.userRoles.get(i);
				if (set) {
					if (set.has(targetUser.user_id)) {
						set.delete(targetUser.user_id);
					}
					this.userRoles[i] = Array.from(set);
				}
			}
			if (request.role >= Role.TrustedUser) {
				this.userRoles.get(request.role)?.add(targetUser.user_id);
			}
		}
		await this.syncUser(this.getUserInfo(targetUser.id));
		if (!this.isTemporary) {
			try {
				await storage.updateRoom(this);
			} catch (err: unknown) {
				if (err instanceof Error) {
					this.log.error(`Failed to update room: ${err.message} ${err.stack}`);
				} else {
					// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
					this.log.error(
						`Failed to update room, and the error thrown was not Error: ${err}`
					);
				}
			}
		}
	}

	public async applySettings(
		request: ApplySettingsRequest,
		context: RoomRequestContext
	): Promise<void> {
		const propsToPerms: Record<keyof Omit<RoomSettings, "grants">, string> = {
			title: "configure-room.set-title",
			description: "configure-room.set-description",
			visibility: "configure-room.set-visibility",
			queueMode: "configure-room.set-queue-mode",
			autoSkipSegments: "configure-room.set-auto-skip",
		};
		const roleToPerms: Record<Exclude<Role, Role.Owner | Role.Administrator>, string> = {
			[Role.UnregisteredUser]: "configure-room.set-permissions.for-all-unregistered-users",
			[Role.RegisteredUser]: "configure-room.set-permissions.for-all-registered-users",
			[Role.TrustedUser]: "configure-room.set-permissions.for-trusted-users",
			[Role.Moderator]: "configure-room.set-permissions.for-moderator",
		};

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
			for (const role of request.settings.grants.getRoles()) {
				if (Object.hasOwnProperty.call(roleToPerms, role)) {
					if (request.settings.grants.getMask(role) === this.grants.getMask(role)) {
						this.log.silly(
							`deleting permissions for role ${role} from request because it did not change`
						);
						request.settings.grants.deleteRole(role);
					}
				} else {
					this.log.silly(
						`deleting permissions for role ${role} from request because that role's permissions can't change`
					);
					request.settings.grants.deleteRole(role);
				}
			}
			if (request.settings.grants.isEmpty) {
				this.log.silly(`deleting grants prop from request because it is empty`);
				delete request.settings.grants;
			}
		}

		// check permissions
		for (const prop in request.settings) {
			if (Object.prototype.hasOwnProperty.call(propsToPerms, prop)) {
				this.grants.check(context.role, propsToPerms[prop]);
			}
		}

		if (request.settings.grants) {
			const newGrants = request.settings.grants;
			for (const role of newGrants.getRoles()) {
				if (Object.hasOwnProperty.call(roleToPerms, role)) {
					this.grants.check(context.role, roleToPerms[role]);
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
			for (const role of request.settings.grants.getRoles()) {
				if (Object.hasOwnProperty.call(roleToPerms, role)) {
					this.grants.setRoleGrants(role, request.settings.grants.getMask(role));
					this.markDirty("grants");
				}
			}
		}

		// go grab segments if being enabled while a video is playing
		if (this.autoSkipSegments && this.videoSegments.length === 0 && this.currentSource) {
			this.wantSponsorBlock = true;
		}
	}

	/**
	 * Request that the room play a video immediately, pushing the current video to the queue. If the video is already in the queue, it will be removed from the queue and start playing. If the video is already playing, this will be ignored.
	 */
	public async playNow(request: PlayNowRequest, context: RoomRequestContext): Promise<void> {
		if (
			this.currentSource !== null &&
			this.currentSource.service === request.video.service &&
			this.currentSource.id === request.video.id
		) {
			// already playing, ignore
			return;
		}

		// First, we need to determine what permissions we need to check for this request.
		const alreadyInQueue = this.isVideoInQueue(request.video); // So we don't need to calculate this again later.
		if (alreadyInQueue) {
			this.grants.check(context.role, "manage-queue.order");
		} else {
			this.grants.check(context.role, "manage-queue.add");
		}

		let videoToPlay: Video;
		if (alreadyInQueue) {
			const [_, item] = await this.queue.evict(request.video);
			videoToPlay = item;
		} else {
			videoToPlay = await InfoExtract.getVideoInfo(request.video.service, request.video.id);
		}
		if (this.currentSource) {
			this.currentSource.startAt = this.realPlaybackPosition;
			await this.queue.pushTop(this.currentSource);
		}
		this.currentSource = videoToPlay;
		this.markDirty("queue");
		this.playbackPosition = 0;
		this._playbackStart = dayjs();
		this.videoSegments = [];
		if (this.autoSkipSegments) {
			this.wantSponsorBlock = true;
		}
	}

	public async shuffle(request: ShuffleRequest, context: RoomRequestContext): Promise<void> {
		this.grants.check(context.role, "manage-queue.order");
		await this.queue.shuffle();
	}

	public async setPlaybackSpeed(
		request: PlaybackSpeedRequest,
		context: RoomRequestContext
	): Promise<void> {
		this.grants.check(context.role, "playback.speed");

		this.flushPlaybackPosition();
		this.playbackSpeed = request.speed;
	}
}

const counterSecondsWatched = new Counter({
	name: "ott_media_seconds_played",
	help: "The number of seconds that media has played. Does not account for how many users were in the room.",
	labelNames: ["service"],
});

const counterMediaQueued = new Counter({
	name: "ott_media_queued",
	help: "The number of items that have been added to queues.",
	labelNames: ["service"],
});

const counterMediaSkipped = new Counter({
	name: "ott_media_skipped",
	help: "The number of items that have been manually skipped by users.",
	labelNames: ["service"],
});

const counterMediaWatched = new Counter({
	name: "ott_media_watched",
	help: "The number of items that have been watched to completion.",
	labelNames: ["service"],
});

const counterRoomRequests = new Counter({
	name: "ott_room_requests_received",
	help: "The number of room requests that have been received",
});
