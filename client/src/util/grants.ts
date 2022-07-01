import { GrantMask, parseIntoGrantMask, PermissionName } from "common/permissions";
import { ref, Ref } from "@vue/composition-api";

export const currentUserGrantMask: Ref<GrantMask> = ref(parseIntoGrantMask(["*"]));

/** A helper for checking grants. */
export class GrantChecker {
	granted(permission: PermissionName) {
		let permMask = parseIntoGrantMask([permission]);
		return (currentUserGrantMask.value & permMask) > 0;
	}
}
