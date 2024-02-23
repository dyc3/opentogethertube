import { Mutex } from "@divine/synchronization";

import { Dirtyable } from "./util";
import { QueueItem, Video, VideoId } from "ott-common/models/video";
import _ from "lodash";
import { VideoNotFoundException } from "./exceptions";

/** A concurrently safe orderable queue for videos. */
export class VideoQueue extends Dirtyable {
	private _items: QueueItem[] = [];
	private lock: Mutex;

	constructor(items?: (Video | QueueItem)[]) {
		super();
		this.lock = new Mutex();

		if (items) {
			this._items = items.filter(v => v !== null && v !== undefined);
		}
	}

	get items() {
		return this._items;
	}

	get length() {
		return this._items.length;
	}

	isAllVideos(items: (Video | QueueItem)[]): boolean {
		return !items.some(item => item === null || item === undefined);
	}

	/** Override all items in the queue */
	async set(items: (Video | QueueItem)[]): Promise<void> {
		await this.lock.protect(() => {
			this._items = items;
			this.markDirty();
		});
	}

	/** Add the given videos to the bottom of the queue. */
	async enqueue(...videos: (Video | QueueItem)[]): Promise<void> {
		if (videos.length === 0) {
			return;
		}
		if (!this.isAllVideos(videos)) {
			throw new Error("Cannot enqueue null or undefined items");
		}
		await this.lock.protect(() => {
			this._items.push(...videos);
			this.markDirty();
		});
	}

	/** Dequeue the next video in the queue. */
	async dequeue(): Promise<QueueItem | undefined> {
		return this.lock.protect(() => {
			let item = this._items.shift();
			this.markDirty();
			return item;
		});
	}

	/** Push the given videos on to the top of the queue. */
	async pushTop(...videos: (Video | QueueItem)[]) {
		if (videos.length === 0) {
			return;
		}
		if (!this.isAllVideos(videos)) {
			throw new Error("Cannot enqueue null or undefined items");
		}
		await this.lock.protect(() => {
			this._items.unshift(...videos);
			this.markDirty();
		});
	}

	/** Insert the given video at the given index. */
	async insert(video: Video | QueueItem, index: number) {
		if (index < 0 || index > this._items.length) {
			throw new Error("Index out of bounds");
		}
		if (video === null || video === undefined) {
			throw new Error("Cannot enqueue null or undefined items");
		}
		await this.lock.protect(() => {
			const newItems = this._items.splice(0, index);
			newItems.push(video);
			newItems.push(...this._items);
			this._items = newItems;
			this.markDirty();
		});
	}

	/**
	 * Move the item at index `fromIdx` to index `toIdx`.
	 */
	async move(fromIdx: number, toIdx: number): Promise<void> {
		if (fromIdx === toIdx) {
			return;
		}
		if (fromIdx < 0 || fromIdx >= this._items.length) {
			throw new Error("'fromIdx' out of bounds");
		}
		if (toIdx < 0 || toIdx >= this._items.length) {
			throw new Error("'toIdx' out of bounds");
		}
		return this.lock.protect(() => {
			const item = this._items.splice(fromIdx, 1)[0];
			this._items.splice(toIdx, 0, item);
			this.markDirty();
		});
	}

	findIndex(video: VideoId): number {
		const matchIdx = _.findIndex(
			this._items,
			item => item.service === video.service && item.id === video.id
		);
		return matchIdx;
	}

	contains(video: VideoId): boolean {
		const matchIdx = this.findIndex(video);
		return matchIdx >= 0;
	}

	/** Remove the video from the queue. */
	async evict(video: VideoId): Promise<[number, QueueItem]> {
		return this.lock.protect(() => {
			const matchIdx = this.findIndex(video);
			if (matchIdx >= 0) {
				const removed = this._items.splice(matchIdx, 1)[0];
				this.markDirty();
				return [matchIdx, removed];
			} else {
				throw new VideoNotFoundException();
			}
		});
	}

	/** Reorder the queue based on the given criteria. Takes the same arguments as lodash `_.orderBy()`. */
	async orderBy(
		iteratees: _.Many<_.ListIterator<QueueItem, _.NotVoid>>,
		orders: string | boolean | readonly (boolean | "asc" | "desc")[] | string[]
	) {
		await this.lock.protect(() => {
			const _oldOrder = _.clone(this._items);
			// @ts-expect-error I'm too lazy to fix the type annotation for iteratees, but it's ok because we dont touch it, and just pass it through.
			this._items = _.orderBy(this._items, iteratees, orders);
			if (
				this._items.length > 0 &&
				!this._items.every((value, index) => _.isEqual(value, _oldOrder[index]))
			) {
				this.markDirty();
			}
		});
	}

	async shuffle() {
		await this.lock.protect(() => {
			this._items = _.shuffle(this._items);
		});
	}

	toJSON() {
		return this.items;
	}
}
