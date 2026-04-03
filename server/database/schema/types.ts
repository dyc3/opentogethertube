import type { QueueItem } from "ott-common/models/video.js";
import type {
	BehaviorOption,
	QueueMode,
	Role,
	UserAccountAttributes,
	Visibility,
} from "ott-common/models/types.js";
import type { GrantMask, OldRoleGrants } from "ott-common/permissions.js";
import type { Category } from "sponsorblock-api";

export type RoomPermissions = [Role, GrantMask][] | OldRoleGrants;

export interface RoomRow {
	"id": number;
	"name": string;
	"title": string;
	"description": string;
	"visibility": Visibility;
	"queueMode": QueueMode;
	"ownerId": number | null;
	"permissions": RoomPermissions | null;
	"role-admin": number[] | null;
	"role-mod": number[] | null;
	"role-trusted": number[] | null;
	"autoSkipSegmentCategories": Category[];
	"prevQueue": QueueItem[] | null;
	"restoreQueueBehavior": BehaviorOption;
	"enableVoteSkip": boolean;
	"createdAt": Date;
	"updatedAt": Date;
}

export interface UserRow extends UserAccountAttributes {
	createdAt: Date;
	updatedAt: Date;
}

export interface CachedVideoRow {
	id: number;
	service: string;
	serviceId: string;
	title: string | null;
	description: string | null;
	thumbnail: string | null;
	length: number | null;
	mime: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export const cachedVideoInfoFields = [
	"title",
	"description",
	"thumbnail",
	"length",
	"mime",
] as const;
