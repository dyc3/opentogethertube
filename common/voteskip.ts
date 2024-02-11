import type { RoomUserInfo } from "./models/types";
import { Grants } from "./permissions";

export function voteSkipThreshold(users: number): number {
	return Math.ceil(users * 0.5);
}

export function countEligibleVoters(users: RoomUserInfo[], grants: Grants): number {
	let count = 0;
	for (const user of users) {
		if (grants.granted(user.role, "playback.skip")) {
			count++;
		}
	}
	return count;
}
