export class OttException extends Error {}

export class PermissionDeniedException extends OttException {
	name = "PermissionDeniedException";

	constructor(permission: string) {
		super(`Permission denied: ${permission}`);
	}
}

export class InvalidRoleException extends OttException {
	name = "InvalidRoleException";

	constructor(role: any) {
		super(`Role ${role} (type: ${typeof role}) is not valid.`);
	}
}
