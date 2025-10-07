import { describe, expect, it } from "vitest";
import { Role } from "../../models/types.js";
import { canKickUser } from "../../userutils.js";

describe("canKickUser", () => {
	it.each([
		[Role.Owner, Role.Administrator, true],
		[Role.Administrator, Role.Owner, false],
		[Role.Administrator, Role.Administrator, false],
		[Role.Administrator, Role.Moderator, true],
		[Role.TrustedUser, Role.UnregisteredUser, true],
		[Role.UnregisteredUser, Role.Administrator, false],
	])(`canKickUser(%i, %i)`, (yourRole: Role, targetRole: Role, expected: boolean) => {
		expect(canKickUser(yourRole, targetRole)).toBe(expected);
	});
});
