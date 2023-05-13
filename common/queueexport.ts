import { QueueItem } from "models/video";

export function exportQueue(queue: QueueItem[]): string {
	return queue.map(buildUrlForQueueItem).join("\n");
}

export function buildUrlForQueueItem(item: QueueItem): string {
	const url = new URL(`ott://video/${item.service}/${item.id}`);
	if (item.startAt) {
		url.searchParams.set("start", item.startAt.toString());
	}
	if (item.endAt) {
		url.searchParams.set("end", item.endAt.toString());
	}
	return url.toString();
}
