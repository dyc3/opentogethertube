import { QueueItem } from "./models/video";

export function exportQueue(queue: QueueItem[]): string {
	return queue.map(buildUrlForQueueItem).join("\n");
}

export function buildUrlForQueueItem(item: QueueItem): string {
	switch (item.service) {
		case "youtube":
			return `https://youtu.be/${item.id}`;
		case "vimeo":
			return `https://vimeo.com/${item.id}`;
		case "dailymotion":
			return `https://dailymotion.com/video/${item.id}`;
		case "direct":
			return item.id;
		case "hls":
			return item.hls_url ?? item.id;
		default:
			throw new Error(`Unknown service: ${item.service}`);
	}
}
