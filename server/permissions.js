const _ = require("lodash");
const { getLogger } = require("../logger.js");
import { PermissionDeniedException, InvalidRoleException } from "./exceptions";
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

/**
 * Get the default permissions.
 * @deprecated
 */
function defaultPermissions() {
	return new Grants({
		[ROLES.UNREGISTERED_USER]: parseIntoGrantMask([
			"playback",
			"manage-queue",
			"chat",
			"configure-room.set-title",
			"configure-room.set-description",
			"configure-room.set-visibility",
			"configure-room.set-queue-mode",
		]),
		[ROLES.REGISTERED_USER]: parseIntoGrantMask([]),
		[ROLES.TRUSTED_USER]: parseIntoGrantMask([]),
		[ROLES.MODERATOR]: parseIntoGrantMask([
			"manage-users.promote-trusted-user",
			"manage-users.demote-trusted-user",
		]),
		[ROLES.ADMINISTRATOR]: parseIntoGrantMask(["*"]),
		[ROLES.OWNER]: parseIntoGrantMask(["*"]),
	});
}

/**
 * Creates a deterministic mask given a list of string form permissions.
 * @param {string[]} perms
 */
function parseIntoGrantMask(perms) {
	if (!(perms instanceof Array)) {
		throw new TypeError(`perms must be an array of strings, got ${typeof perms}`);
	}
	let mask = 0;
	for (let perm of perms) {
		_.forOwn(permMaskMap, (value, key) => {
			if (key.startsWith(perm) || perm === "*") {
				mask |= value;
			}
		});
	}
	return mask;
}

/**
 * Get the full grant mask for a role, accounting for permission inheritance.
 * @param {Object} grants
 * @param {Number} role
 * @deprecated
 */
function getFullGrantMask(grants, role) {
	let fullmask = grants[role];
	for (let i = role - 1; i >= ROLES.UNREGISTERED_USER; i--) {
		fullmask |= grants[i];
	}
	return fullmask;
}

/**
 * Get a mask of permissions that are allowed for the given role, based on stuff like minRole.
 * @param {Number} role
 */
function getValidationMask(role) {
	let masks = PERMISSIONS.filter(p => role >= p.minRole).map(p => p.mask);
	if (masks.length === 0) {
		return parseIntoGrantMask(["*"]);
	}
	return masks.reduce((full, mask) => full | mask);
}

/**
 * Check if the given role is valid.
 * @param {Number} role
 */
function isRoleValid(role) {
	if (typeof role === "number") {
		return -1 <= role <= 4;
	}
	else {
		return false;
	}
}

/**
 * @param {string|Number} role
 */
function _normalizeRoleId(role) {
	if (typeof role === "string") {
		role = parseInt(role);
	}
	return role;
}

/**
 * Checks if the given role is granted the permission, given the grants.
 * @param {Object} grants
 * @param {Number} role
 * @param {string} permission
 * @deprecated
 */
function granted(grants, role, permission) {
	const g = new Grants(grants);
	return g.granted(role, permission);
}

/**
 * Checks to see if the permission is granted. Throws an exception if it fails.
 * @param {Object} grants
 * @param {Number} role
 * @param {string} permission
 * @throws PermissionDeniedException
 * @deprecated
 */
function check(grants, role, permission) {
	const g = new Grants(grants);
	g.check(role, permission);
}

/**
 * Represents permissions for all roles. Handles permission inheritance, and serialization/deserialization.
 * If grants are not provided, the defaults will be used.
 */
export class Grants {
	/**
	 * @param {Object|undefined} grants Opional object that maps roles to grant masks.
	 */
	constructor(grants=undefined) {
		if (!grants) {
			grants = defaultPermissions();
		}
		this.setAllGrants(grants);
	}

	/**
	 * @param {Object} grants Opional object that maps roles to grant masks.
	 */
	setAllGrants(grants) {
		this.masks = {};
		if (grants instanceof Grants) {
			this.setAllGrants(grants.masks);
		}
		else {
			for (const role in grants) {
				if (Object.hasOwnProperty.call(grants, role)) {
					this.setRoleGrants(role, grants[role]);
				}
			}
		}
	}

	/**
	 * @param {string[]|Number} permissions
	 * @returns {Number} Grant bitmask
	 */
	_normalizePermissionsInput(permissions) {
		if (permissions instanceof Array) {
			permissions = parseIntoGrantMask(permissions);
		}
		return permissions;
	}

	/**
	 * @param {Number} role
	 * @param {string[]|Number} permissions
	 * @throws InvalidRoleException
	 */
	setRoleGrants(role, permissions) {
		role = _normalizeRoleId(role);
		if (!isRoleValid(role)) {
			throw new InvalidRoleException(role);
		}
		permissions = this._normalizePermissionsInput(permissions);
		const validation = getValidationMask(role);
		this.masks[role] = permissions & validation;
		this._processInheiritance();
	}

	_processInheiritance() {
		let fullmask = 0;
		for (let i = ROLES.UNREGISTERED_USER; i <= ROLES.ADMINISTRATOR; i++) {
			fullmask |= this.masks[i];
			this.masks[i] = fullmask;
		}
	}

	/**
	 * Checks if the given role is granted the permission, given the grants.
	 * @param {Number} role
	 * @param {string|Permission} permission
	 */
	granted(role, permission) {
		role = _normalizeRoleId(role);
		let checkmask;
		if (permission instanceof Permission) {
			checkmask = permission.mask;
		}
		else if (typeof permission === "string") {
			checkmask = parseIntoGrantMask([permission]);
		}
		else {
			return false;
		}
		let fullmask = this.masks[role];
		let isGranted = (fullmask & checkmask) === checkmask;
		if (isGranted) {
			log.info(`${permission} granted to ${ROLE_DISPLAY_NAMES[role]}`);
		}
		else {
			log.error(`${permission} denied to ${ROLE_DISPLAY_NAMES[role]}`);
		}
		return isGranted;
	}

	/**
	 * Checks to see if the permission is granted. Throws an exception if it fails.
	 * @param {Number} role
	 * @param {string|Permission} permission
	 * @throws PermissionDeniedException
	 */
	check(role, permission) {
		role = _normalizeRoleId(role);
		if (!this.granted(role, permission)) {
			throw new PermissionDeniedException(permission);
		}
	}

	/**
	 * Keep only the specified roles, delete all other grant masks.
	 * @param {Number[]} roles
	 */
	filterRoles(roles) {
		for (const role in this.masks) {
			if (Object.hasOwnProperty.call(this.masks, role)) {
				if (!roles.includes(role)) {
					delete this.masks[role];
				}
			}
		}
	}

	/**
	 * Serialize grants to a string. Used to store grants in the database.
	 * @returns {string}
	 */
	serialize() {
		return JSON.stringify(this.masks);
	}

	/**
	 * Deserialize grants from a string.
	 * @param {string} value
	 */
	deserialize(value) {
		let g = JSON.parse(value);
		this.setAllGrants(g);
	}

	toJSON() {
		return this.masks;
	}
}

module.exports = {
	ROLES,
	ROLE_NAMES,
	ROLE_DISPLAY_NAMES,
	PERMISSIONS,
	PERMISSION_HEIRARCHY,
	Grants,
	defaultPermissions,
	parseIntoGrantMask,
	getFullGrantMask,
	getValidationMask,
	granted,
	check,
};
