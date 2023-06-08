import { parseIntoGrantMask, PermissionName } from "ott-common/permissions";
import { useStore } from "../store";

/** Checks if the current user is granted the given permission. */
export function granted(permission: PermissionName) {
	const store = useStore();
	if (!store) {
		console.error("granted(): No store found.");
		return true;
	}
	const usermask = store.getters["users/grants"];
	const permMask = parseIntoGrantMask([permission]);
	return (usermask & permMask) > 0;
}
