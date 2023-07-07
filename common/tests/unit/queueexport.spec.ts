import { exportQueue } from "../../queueexport";
import type { QueueItem } from "../../models/video";

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
			{
				service: "direct",
				id: "https://example.com/video.mp4",
			},
			{
				service: "hls",
				id: "video.m3u8",
				hls_url: "https://example.com/video.m3u8",
			},
		];

		const result = exportQueue(queue);

		expect(result.split("\n")).toEqual([
			"https://youtu.be/1",
			"https://vimeo.com/5",
			"https://example.com/video.mp4",
			"https://example.com/video.m3u8",
		]);
	});
});
