import { Role } from "./models/types";

export class OttException extends Error {}

export class PermissionDeniedException extends OttException {
	name = "PermissionDeniedException";

	constructor(permission: string) {
		super(`Permission denied: ${permission}`);
	}
}

export class InvalidRoleException extends OttException {
	name = "InvalidRoleException";

	constructor(role: Role) {
		super(`Role ${role.toString()} (type: ${typeof role}) is not valid.`);
	}
}
