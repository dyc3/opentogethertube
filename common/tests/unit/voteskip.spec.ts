import { describe, it, expect } from "vitest";
import { Grants, parseIntoGrantMask } from "../../permissions";
import { PlayerStatus, Role, RoomUserInfo } from "../../models/types";
import { voteSkipThreshold, countEligibleVoters } from "../../voteskip";

describe("voteskip", () => {
	it.each([
		[1, 1],
		[2, 1],
		[3, 2],
		[4, 2],
		[5, 3],
		[6, 3],
		[7, 4],
		[8, 4],
		[9, 5],
		[10, 5],
		[11, 6],
		[12, 6],
		[13, 7],
		[14, 7],
		[15, 8],
		[16, 8],
	])(
		"should give a reasonable threshold for %s users",
		(users: number, expectedThresh: number) => {
			expect(voteSkipThreshold(users)).toBe(expectedThresh);
		}
	);

	it("should count eligible voters", () => {
		const users: RoomUserInfo[] = [
			{
				id: "foo1",
				name: "foo1",
				isLoggedIn: false,
				status: PlayerStatus.none,
				role: Role.UnregisteredUser,
			},
			{
				id: "foo2",
				name: "foo2",
				isLoggedIn: true,
				status: PlayerStatus.none,
				role: Role.RegisteredUser,
			},
			{
				id: "foo3",
				name: "foo3",
				isLoggedIn: true,
				status: PlayerStatus.none,
				role: Role.Moderator,
			},
			{
				id: "foo4",
				name: "foo4",
				isLoggedIn: true,
				status: PlayerStatus.none,
				role: Role.Administrator,
			},
			{
				id: "foo5",
				name: "foo5",
				isLoggedIn: true,
				status: PlayerStatus.none,
				role: Role.Owner,
			},
		];
		const grants = new Grants();
		let mask = grants.getMask(Role.UnregisteredUser);
		mask &= ~parseIntoGrantMask(["playback"]);
		grants.setRoleGrants(Role.UnregisteredUser, mask);
		mask = grants.getMask(Role.RegisteredUser);
		mask &= ~parseIntoGrantMask(["playback.skip"]);
		grants.setRoleGrants(Role.RegisteredUser, mask);

		expect(countEligibleVoters(users, grants)).toBe(3);
	});
});
