const _ = require("lodash");

const ROOM_PERMISSIONS = {
	PLAYBACK: {
		PLAYPAUSE: 1<<0,
		SKIP: 1<<1,
		SEEK: 1<<2,
	},
	MANAGE_QUEUE: {
		ADD: 1<<3,
		REMOVE: 1<<4,
		ORDER: 1<<5,
		VOTE: 1<<6,
	},
	CHAT: 1<<7,
	CONFIGURE_ROOM: {
		SET_TITLE: 1<<8,
		SET_DESCRIPTION: 1<<9,
		SET_VISIBILITY: 1<<10,
		SET_QUEUE_MODE: 1<<11,
		SET_PERMISSIONS: {
			FOR_MODERATOR: 1<<12,
			FOR_TRUSTED_USER: 1<<13,
			FOR_ALL_REGISTERED_USERS: 1<<14,
			FOR_ALL_UNREGISTERED_USERS: 1<<15,
		},
	},
	MANAGE_USERS: {
		PROMOTE_ADMIN: 1<<16,
		DEMOTE_ADMIN: 1<<17,
		PROMOTE_MODERATOR: 1<<18,
		DEMOTE_MODERATOR: 1<<19,
		PROMOTE_TRUSTED_USER: 1<<20,
		DEMOTE_TRUSTED_USER: 1<<21,
	},
};

const ROLES = {
	ADMINISTRATOR: 4,
	MODERATOR: 3,
	TRUSTED_USER: 2,
	REGISTERED_USER: 1,
	UNREGISTERED_USER: 0,
};

let permMaskMap = {
	"playback.play-pause": ROOM_PERMISSIONS.PLAYBACK.PLAYPAUSE,
	"playback.skip": ROOM_PERMISSIONS.PLAYBACK.SKIP,
	"playback.seek": ROOM_PERMISSIONS.PLAYBACK.SEEK,
	"manage-queue.add": ROOM_PERMISSIONS.MANAGE_QUEUE.ADD,
	"manage-queue.remove": ROOM_PERMISSIONS.MANAGE_QUEUE.REMOVE,
	"manage-queue.order": ROOM_PERMISSIONS.MANAGE_QUEUE.ORDER,
	"manage-queue.vote": ROOM_PERMISSIONS.MANAGE_QUEUE.VOTE,
	"chat": ROOM_PERMISSIONS.CHAT,
	"configure-room.set-title": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_TITLE,
	"configure-room.set-description": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_DESCRIPTION,
	"configure-room.set-visibility": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_VISIBILITY,
	"configure-room.set-queue-mode": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_QUEUE_MODE,
	"configure-room.set-permissions.for-moderator": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_MODERATOR,
	"configure-room.set-permissions.for-trusted-users": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_TRUSTED_USER,
	"configure-room.set-permissions.for-all-registered-users": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_ALL_REGISTERED_USERS,
	"configure-room.set-permissions.for-all-unregistered-users": ROOM_PERMISSIONS.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_ALL_UNREGISTERED_USERS,
	"manage-users.promote-admin": ROOM_PERMISSIONS.MANAGE_USERS.PROMOTE_ADMIN,
	"manage-users.demote-admin": ROOM_PERMISSIONS.MANAGE_USERS.DEMOTE_ADMIN,
	"manage-users.promote-moderator": ROOM_PERMISSIONS.MANAGE_USERS.PROMOTE_MODERATOR,
	"manage-users.demote-moderator": ROOM_PERMISSIONS.MANAGE_USERS.DEMOTE_MODERATOR,
	"manage-users.promote-trusted-user": ROOM_PERMISSIONS.MANAGE_USERS.PROMOTE_TRUSTED_USER,
	"manage-users.demote-trusted-user": ROOM_PERMISSIONS.MANAGE_USERS.DEMOTE_TRUSTED_USER,
};

module.exports = {
	ROOM_PERMISSIONS,
	ROLES,

	defaultPermissions() {
		return {
			[ROLES.UNREGISTERED_USER]: this.parseIntoGrantMask([
				"playback",
				"manage-queue",
				"chat",
				"configure-room.set-title",
				"configure-room.set-description",
				"configure-room.set-visibility",
				"configure-room.set-queue-mode",
			]),
			[ROLES.REGISTERED_USER]: this.parseIntoGrantMask([]),
			[ROLES.TRUSTED_USER]: this.parseIntoGrantMask([]),
			[ROLES.MODERATOR]: this.parseIntoGrantMask([
				"manage-users.promote-trusted-user",
				"manage-users.demote-trusted-user",
			]),
			[ROLES.ADMINISTRATOR]: this.parseIntoGrantMask([
				"configure-room.set-permissions",
				"manage-users",
			]),
		};
	},

	/**
	 * Creates a deterministic mask given a list of string form permissions.
	 */
	parseIntoGrantMask(perms) {
		let mask = 0;
		for (let perm of perms) {
			_.forOwn(permMaskMap, (value, key) => {
				if (key.startsWith(perm)) {
					mask |= value;
				}
			});
		}
		return mask;
	},

	/**
	 * Checks if the given role is granted the permission, given the grants.
	 */
	granted(grants, role, permission) {
		let fullmask = grants[role];
		for (let i = role - 1; i >= 0; i--) {
			fullmask |= grants[i];
		}
		return (fullmask & permMaskMap[permission]) > 0;
	},
};
