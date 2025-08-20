import { SponsorBlock } from "sponsorblock-api";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildClients, redisClient } from "../../redisclient.js";
import * as sponsorblock from "../../sponsorblock.js";

vi.mock("sponsorblock-api", () => {
	return {
		SponsorBlock: class {
			getSegments = vi.fn().mockResolvedValue([{ start: 0, end: 1, category: "sponsor" }]);
		},
	};
});

describe("SponsorBlock", () => {
	beforeAll(async () => {
		await buildClients();
	});

	it("should generate and return the same user id and only ping redis once", async () => {
		sponsorblock.clearUserId();
		let getSpy = vi.spyOn(redisClient, "get").mockResolvedValue(null);
		let setSpy = vi.spyOn(redisClient, "set");
		const { getSponsorBlockUserId } = sponsorblock;
		const userId = await getSponsorBlockUserId();
		expect(userId).toBeDefined();
		const userId2 = await getSponsorBlockUserId();
		expect(userId2).toEqual(userId);

		expect(redisClient.get).toHaveBeenCalledTimes(1);
		expect(redisClient.set).toHaveBeenCalledTimes(1);
		getSpy.mockRestore();
		setSpy.mockRestore();
	});

	it("should always return the same user id and only ping redis once", async () => {
		sponsorblock.clearUserId();
		let getSpy = vi.spyOn(redisClient, "get").mockResolvedValue("testuserid");
		let setSpy = vi.spyOn(redisClient, "set");
		const { getSponsorBlockUserId } = sponsorblock;
		const userId = await getSponsorBlockUserId();
		expect(userId).toBe("testuserid");
		const userId2 = await getSponsorBlockUserId();
		expect(userId2).toBe("testuserid");

		expect(redisClient.get).toHaveBeenCalledTimes(1);
		expect(redisClient.set).not.toHaveBeenCalled();
		getSpy.mockRestore();
		setSpy.mockRestore();
	});

	it("should fetch new segments if parsing cached entry fails", async () => {
		let getSpy = vi.spyOn(redisClient, "get").mockResolvedValue("[invalid json");
		let setSpy = vi.spyOn(redisClient, "setEx");
		const { fetchSegments } = sponsorblock;
		const segments = await fetchSegments("testvideo");
		expect(segments).toEqual([{ start: 0, end: 1, category: "sponsor" }]);
		expect(redisClient.get).toHaveBeenCalledTimes(1);
		expect(redisClient.setEx).toHaveBeenCalledTimes(1);
		getSpy.mockRestore();
		setSpy.mockRestore();
	});
});
