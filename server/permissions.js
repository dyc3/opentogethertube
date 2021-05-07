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
	new Permission({ name: "playback.play-pause", mask: 1<<0, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "playback.skip", mask: 1<<1, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "playback.seek", mask: 1<<2, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.add", mask: 1<<3, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.remove", mask: 1<<4, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.order", mask: 1<<5, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "manage-queue.vote", mask: 1<<6, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "chat", mask: 1<<7, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-title", mask: 1<<8, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-description", mask: 1<<9, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-visibility", mask: 1<<10, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-queue-mode", mask: 1<<11, minRole: ROLES.UNREGISTERED_USER }),
	new Permission({ name: "configure-room.set-permissions.for-moderator", mask: 1<<12, minRole: ROLES.ADMINISTRATOR }),
	new Permission({ name: "configure-room.set-permissions.for-trusted-users", mask: 1<<13, minRole: ROLES.MODERATOR }),
	new Permission({ name: "configure-room.set-permissions.for-all-registered-users", mask: 1<<14, minRole: ROLES.TRUSTED_USER }),
	new Permission({ name: "configure-room.set-permissions.for-all-unregistered-users", mask: 1<<15, minRole: ROLES.REGISTERED_USER }),
	// Permission to promote a user TO admin
	new Permission({ name: "manage-users.promote-admin", mask: 1<<16, minRole: ROLES.ADMINISTRATOR }),
	// Permission to demote a user FROM admin
	new Permission({ name: "manage-users.demote-admin", mask: 1<<17, minRole: ROLES.ADMINISTRATOR }),
	new Permission({ name: "manage-users.promote-moderator", mask: 1<<18, minRole: ROLES.MODERATOR }),
	new Permission({ name: "manage-users.demote-moderator", mask: 1<<19, minRole: ROLES.MODERATOR }),
	new Permission({ name: "manage-users.promote-trusted-user", mask: 1<<20, minRole: ROLES.TRUSTED_USER }),
	new Permission({ name: "manage-users.demote-trusted-user", mask: 1<<21, minRole: ROLES.TRUSTED_USER }),
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
	 * @param {string[]} perms
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

	/**
	 * Get the full grant mask for a role, accounting for permission inheritance.
	 * @param {Object} grants
	 * @param {int} role
	 */
	getFullGrantMask(grants, role) {
		let fullmask = grants[role];
		for (let i = role - 1; i >= ROLES.UNREGISTERED_USER; i--) {
			fullmask |= grants[i];
		}
		return fullmask;
	},

	/**
	 * Checks if the given role is granted the permission, given the grants.
	 * @param {Object} grants
	 * @param {Number} role
	 * @param {string} permission
	 */
	granted(grants, role, permission) {
		if (typeof permission !== "string") {
			return false;
		}
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
	 * @param {Object} grants
	 * @param {Number} role
	 * @param {string} permission
	 * @throws PermissionDeniedException
	 */
	check(grants, role, permission) {
		if (!this.granted(grants, role, permission)) {
			throw new PermissionDeniedException(permission);
		}
	},

	/**
	 * Get a mask of permissions that are allowed for the given role, based on stuff like minRole.
	 * @param {Number} role
	 */
	getValidationMask(role) {
		return PERMISSIONS.filter(p => role >= p.minRole).map(p => p.mask).reduce((full, mask) => full | mask);
	},
};
