import { parseIntoGrantMask, PermissionName } from "ott-common/permissions";
import { useStore } from "../store";

/** Checks if the current user is granted the given permission. */
export function granted(permission: PermissionName) {
	let store = useStore();
	if (!store) {
		console.error("granted(): No store found.");
		return true;
	}
	// let usermask = store.getters.['users/grants'];
	let usermask = 4194303; // FIXME: grab from store
	let permMask = parseIntoGrantMask([permission]);
	return (usermask & permMask) > 0;
}
