const _ = require("lodash");
const { getLogger } = require("../logger.js");
import { PermissionDeniedException, InvalidRoleException } from "./exceptions";
import { Role } from "../common/models/types";
const log = getLogger("permissions");

/** @deprecated */
const ROLES = {
	ADMINISTRATOR: Role.Administrator,
	MODERATOR: Role.Moderator,
	TRUSTED_USER: Role.TrustedUser,
	REGISTERED_USER: Role.RegisteredUser,
	UNREGISTERED_USER: Role.UnregisteredUser,
	OWNER: Role.Owner,
};

const ROLE_NAMES = {
	[Role.Administrator]: "admin",
	[Role.Moderator]: "mod",
	[Role.TrustedUser]: "trusted",
	[Role.RegisteredUser]: "registered",
	[Role.UnregisteredUser]: "unregistered",
	[Role.Owner]: "owner",
};

const ROLE_DISPLAY_NAMES = {
	[Role.Administrator]: "Administrator",
	[Role.Moderator]: "Moderator",
	[Role.TrustedUser]: "Trusted User",
	[Role.RegisteredUser]: "Registered User",
	[Role.UnregisteredUser]: "Unregistered User",
	[Role.Owner]: "Owner",
};

/** @deprecated */
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
		this.minRole = Role.UnregisteredUser;
		Object.assign(this, args);
	}
}

export const PERMISSIONS = [
	new Permission({ name: "playback.play-pause", mask: 1<<0, minRole: Role.UnregisteredUser }),
	new Permission({ name: "playback.skip", mask: 1<<1, minRole: Role.UnregisteredUser }),
	new Permission({ name: "playback.seek", mask: 1<<2, minRole: Role.UnregisteredUser }),
	new Permission({ name: "manage-queue.add", mask: 1<<3, minRole: Role.UnregisteredUser }),
	new Permission({ name: "manage-queue.remove", mask: 1<<4, minRole: Role.UnregisteredUser }),
	new Permission({ name: "manage-queue.order", mask: 1<<5, minRole: Role.UnregisteredUser }),
	new Permission({ name: "manage-queue.vote", mask: 1<<6, minRole: Role.UnregisteredUser }),
	new Permission({ name: "chat", mask: 1<<7, minRole: Role.UnregisteredUser }),
	new Permission({ name: "configure-room.set-title", mask: 1<<8, minRole: Role.UnregisteredUser }),
	new Permission({ name: "configure-room.set-description", mask: 1<<9, minRole: Role.UnregisteredUser }),
	new Permission({ name: "configure-room.set-visibility", mask: 1<<10, minRole: Role.UnregisteredUser }),
	new Permission({ name: "configure-room.set-queue-mode", mask: 1<<11, minRole: Role.UnregisteredUser }),
	new Permission({ name: "configure-room.set-permissions.for-moderator", mask: 1<<12, minRole: Role.Administrator }),
	new Permission({ name: "configure-room.set-permissions.for-trusted-users", mask: 1<<13, minRole: Role.Moderator }),
	new Permission({ name: "configure-room.set-permissions.for-all-registered-users", mask: 1<<14, minRole: Role.TrustedUser }),
	new Permission({ name: "configure-room.set-permissions.for-all-unregistered-users", mask: 1<<15, minRole: Role.RegisteredUser }),
	// Permission to promote a user TO admin
	new Permission({ name: "manage-users.promote-admin", mask: 1<<16, minRole: Role.Administrator }),
	// Permission to demote a user FROM admin
	new Permission({ name: "manage-users.demote-admin", mask: 1<<17, minRole: Role.Administrator }),
	new Permission({ name: "manage-users.promote-moderator", mask: 1<<18, minRole: Role.Moderator }),
	new Permission({ name: "manage-users.demote-moderator", mask: 1<<19, minRole: Role.Moderator }),
	new Permission({ name: "manage-users.promote-trusted-user", mask: 1<<20, minRole: Role.TrustedUser }),
	new Permission({ name: "manage-users.demote-trusted-user", mask: 1<<21, minRole: Role.TrustedUser }),
];

const permMaskMap = Object.fromEntries(PERMISSIONS.map(p => [p.name, p.mask]));

/**
 * Get the default permissions.
 * @deprecated
 */
function defaultPermissions() {
	return new Grants({
		[Role.UnregisteredUser]: parseIntoGrantMask([
			"playback",
			"manage-queue",
			"chat",
			"configure-room.set-title",
			"configure-room.set-description",
			"configure-room.set-visibility",
			"configure-room.set-queue-mode",
		]),
		[Role.RegisteredUser]: parseIntoGrantMask([]),
		[Role.TrustedUser]: parseIntoGrantMask([]),
		[Role.Moderator]: parseIntoGrantMask([
			"manage-users.promote-trusted-user",
			"manage-users.demote-trusted-user",
		]),
		[Role.Administrator]: parseIntoGrantMask(["*"]),
		[Role.Owner]: parseIntoGrantMask(["*"]),
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
 * @param {Role} role
 * @deprecated
 */
function getFullGrantMask(grants, role) {
	let fullmask = grants[role];
	for (let i = role - 1; i >= Role.UnregisteredUser; i--) {
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
 * @param {Role} role
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
 * @param {Role} role
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
 * @param {Role} role
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
		// HACK: force owner to always have all permissions
		this.setRoleGrants(Role.Owner, parseIntoGrantMask(["*"]));
	}

	/**
	 *
	 * @param {Role} role
	 * @returns {number}
	 */
	getMask(role) {
		return this.masks[role];
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
	 * @param {Role} role
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
		for (let i = Role.UnregisteredUser; i <= Role.Administrator; i++) {
			fullmask |= this.masks[i];
			this.masks[i] = fullmask;
		}
	}

	/**
	 * Checks if the given role is granted the permission, given the grants.
	 * @param {Role} role
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
	 * @param {Role} role
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
	 * @param {Role[]} roles
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
		// HACK: force owner to always have all permissions.
		this.setRoleGrants(Role.Owner, parseIntoGrantMask(["*"]));
	}

	toJSON() {
		return this.masks;
	}
}

const _exp = {
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
module.exports = _exp;
export default _exp;
