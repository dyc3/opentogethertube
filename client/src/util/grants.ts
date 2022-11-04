import { GrantMask, parseIntoGrantMask, PermissionName } from "common/permissions";
import { ref, Ref } from "vue";

export const currentUserGrantMask: Ref<GrantMask> = ref(parseIntoGrantMask(["*"]));

/** Checks if the current user is granted the given permission. */
export function granted(permission: PermissionName) {
	let permMask = parseIntoGrantMask([permission]);
	return (currentUserGrantMask.value & permMask) > 0;
}

/** @deprecated A helper for checking grants. */
export class GrantChecker {
	granted = granted;
}
