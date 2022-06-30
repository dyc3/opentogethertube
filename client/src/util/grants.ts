import { GrantMask, parseIntoGrantMask, PermissionName } from "common/permissions";
import type { Store } from "vuex";

/** @deprecated temporary until vuex store gets fully converted to typescript */
interface GrantsState {
	users: {
		you: {
			grants: GrantMask;
		};
	};
}

/** A helper for checking grants. */
export class GrantChecker {
	store: Store<GrantsState>;

	constructor(store: Store<GrantsState>) {
		this.store = store;
	}

	granted(permission: PermissionName) {
		let userMask = this.store.state.users.you.grants;
		let permMask = parseIntoGrantMask([permission]);
		return (userMask & permMask) > 0;
	}
}
