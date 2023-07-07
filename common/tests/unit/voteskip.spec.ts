import { voteSkipThreshold } from "../../voteskip";

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
});
