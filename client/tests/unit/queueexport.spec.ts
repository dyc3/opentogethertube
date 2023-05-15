import { it, describe, expect } from "vitest";
import { exportQueue } from "ott-common/queueexport";
import type { QueueItem } from "ott-common/models/video";

// TODO: move these to tests in ott-common
describe("exportQueue", () => {
	it("should export a queue of 2 videos", () => {
		const queue: QueueItem[] = [
			{
				service: "youtube",
				id: "1",
			},
			{
				service: "vimeo",
				id: "5",
			},
		];

		const result = exportQueue(queue);

		expect(result).toBe("ott://video/youtube/1\nott://video/vimeo/5");
	});

	it("should include start and end times", () => {
		const queue: QueueItem[] = [
			{
				service: "youtube",
				id: "1",
				startAt: 10,
				endAt: 20,
			},
		];

		const result = exportQueue(queue);

		expect(result).toBe("ott://video/youtube/1?start=10&end=20");
	});
});
