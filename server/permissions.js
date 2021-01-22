const _ = require("lodash");
const { getLogger } = require("../logger.js");
const { PermissionDeniedException } = require("./exceptions.js");
const log = getLogger("permissions");

const ROLES = {
	ADMINISTRATOR: 4,
	MODERATOR: 3,
	TRUSTED_USER: 2,
	REGISTERED_USER: 1,
	UNREGISTERED_USER: 0,
	OWNER: -1,
};

const ROLE_NAMES = {
	[ROLES.ADMINISTRATOR]: "admin",
	[ROLES.MODERATOR]: "mod",
	[ROLES.TRUSTED_USER]: "trusted",
	[ROLES.REGISTERED_USER]: "registered",
	[ROLES.UNREGISTERED_USER]: "unregistered",
	[ROLES.OWNER]: "owner",
};

const ROLE_DISPLAY_NAMES = {
	[ROLES.ADMINISTRATOR]: "Administrator",
	[ROLES.MODERATOR]: "Moderator",
	[ROLES.TRUSTED_USER]: "Trusted User",
	[ROLES.REGISTERED_USER]: "Registered User",
	[ROLES.UNREGISTERED_USER]: "Unregistered User",
	[ROLES.OWNER]: "Owner",
};

// TODO: create dynamically
const PERMISSION_HEIRARCHY = {
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

class Permission {
	constructor(args) {
		this.name = "";
		this.mask = 0;
		this.minRole = ROLES.UNREGISTERED_USER;
		Object.assign(this, args);
	}
}

const PERMISSIONS = [
	new Permission({ name: "playback.play-pause", mask: PERMISSION_HEIRARCHY.PLAYBACK.PLAYPAUSE, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "playback.skip", mask: PERMISSION_HEIRARCHY.PLAYBACK.SKIP, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "playback.seek", mask: PERMISSION_HEIRARCHY.PLAYBACK.SEEK, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.add", mask: PERMISSION_HEIRARCHY.MANAGE_QUEUE.ADD, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.remove", mask: PERMISSION_HEIRARCHY.MANAGE_QUEUE.REMOVE, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.order", mask: PERMISSION_HEIRARCHY.MANAGE_QUEUE.ORDER, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.vote", mask: PERMISSION_HEIRARCHY.MANAGE_QUEUE.VOTE, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "chat", mask: PERMISSION_HEIRARCHY.CHAT, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-title", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_TITLE, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-description", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_DESCRIPTION, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-visibility", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_VISIBILITY, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-queue-mode", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_QUEUE_MODE, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-permissions.for-moderator", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_MODERATOR, minRole: ROLES.ADMINISTRATOR }),
	new Permission({ name: "configure-room.set-permissions.for-trusted-users", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_TRUSTED_USER, minRole: ROLES.MODERATOR }),
	new Permission({ name: "configure-room.set-permissions.for-all-registered-users", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_ALL_REGISTERED_USERS, minRole: ROLES.TRUSTED_USER }),
	new Permission({ name: "configure-room.set-permissions.for-all-unregistered-users", mask: PERMISSION_HEIRARCHY.CONFIGURE_ROOM.SET_PERMISSIONS.FOR_ALL_UNREGISTERED_USERS, minRole: ROLES.REGISTERED_USER }),
	// Permission to promote a user TO admin
	new Permission({ name: "manage-users.promote-admin", mask: PERMISSION_HEIRARCHY.MANAGE_USERS.PROMOTE_ADMIN, minRole: ROLES.ADMINISTRATOR }),
	// Permission to demote a user FROM admin
	new Permission({ name: "manage-users.demote-admin", mask: PERMISSION_HEIRARCHY.MANAGE_USERS.DEMOTE_ADMIN, minRole: ROLES.ADMINISTRATOR }),
	new Permission({ name: "manage-users.promote-moderator", mask: PERMISSION_HEIRARCHY.MANAGE_USERS.PROMOTE_MODERATOR, minRole: ROLES.MODERATOR }),
	new Permission({ name: "manage-users.demote-moderator", mask: PERMISSION_HEIRARCHY.MANAGE_USERS.DEMOTE_MODERATOR, minRole: ROLES.MODERATOR }),
	new Permission({ name: "manage-users.promote-trusted-user", mask: PERMISSION_HEIRARCHY.MANAGE_USERS.PROMOTE_TRUSTED_USER, minRole: ROLES.TRUSTED_USER }),
	new Permission({ name: "manage-users.demote-trusted-user", mask: PERMISSION_HEIRARCHY.MANAGE_USERS.DEMOTE_TRUSTED_USER, minRole: ROLES.TRUSTED_USER }),
];

const permMaskMap = Object.fromEntries(PERMISSIONS.map(p => [p.name, p.mask]));

module.exports = {
	ROLES,
	ROLE_NAMES,
	ROLE_DISPLAY_NAMES,
	PERMISSIONS,
	PERMISSION_HEIRARCHY,

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
			[ROLES.ADMINISTRATOR]: this.parseIntoGrantMask(["*"]),
			[ROLES.OWNER]: this.parseIntoGrantMask(["*"]),
		};
	},

	/**
	 * Creates a deterministic mask given a list of string form permissions.
	 */
	parseIntoGrantMask(perms) {
		let mask = 0;
		for (let perm of perms) {
			_.forOwn(permMaskMap, (value, key) => {
				if (key.startsWith(perm) || perm === "*") {
					mask |= value;
				}
			});
		}
		return mask;
	},

	getFullGrantMask(grants, role) {
		let fullmask = grants[role];
		for (let i = role - 1; i >= ROLES.UNREGISTERED_USER; i--) {
			fullmask |= grants[i];
		}
		return fullmask;
	},

	/**
	 * Checks if the given role is granted the permission, given the grants.
	 */
	granted(grants, role, permission) {
		let fullmask = this.getFullGrantMask(grants, role);
		let checkmask = this.parseIntoGrantMask([permission]);
		let granted = (fullmask & checkmask) === checkmask;
		if (granted) {
			log.info(`${permission} granted to ${ROLE_DISPLAY_NAMES[role]}`);
		}
		else {
			log.error(`${permission} denied to ${ROLE_DISPLAY_NAMES[role]}`);
		}
		return granted;
	},

	/**
	 * Checks to see if the permission is granted. Throws an exception if it fails.
	 * @param {*} grants
	 * @param {*} role
	 * @param {*} permission
	 * @throws PermissionDeniedException
	 */
	check(grants, role, permission) {
		if (!this.granted(grants, role, permission)) {
			throw new PermissionDeniedException(permission);
		}
	},
};
