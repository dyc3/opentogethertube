import { PermissionName, parseIntoGrantMask } from "ott-common/permissions";
import { useStore } from "@/store";

export function useGrants() {
	const store = useStore();
	if (!store) {
		console.error("useGrants: No store found.");
		return () => true;
	}

	/** Checks if the current user is granted the given permission. */
	function granted(permission: PermissionName) {
		const usermask = store.getters["users/grants"];
		const permMask = parseIntoGrantMask([permission]);
		return (usermask & permMask) > 0;
	}

	return granted;
}
