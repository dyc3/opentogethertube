/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import { Video, VideoId, VideoMetadata, VideoService } from "ott-common/models/video";
import { IncompleteServiceAdapterException } from "./exceptions";
import { getLogger } from "./logger";

const log = getLogger("serviceadapter");
export interface VideoRequest {
	id: string;
	missingInfo: (keyof VideoMetadata)[];
}

export class ServiceAdapter {
	/**
	 * A string that identifies this service adapter.
	 */
	get serviceId(): VideoService {
		throw new IncompleteServiceAdapterException(
			`Service adapter ${this.constructor.name} does not have a serviceId property`
		);
	}

	/**
	 * A boolean that indicates whether video metadata can be safely cached.
	 */
	get isCacheSafe(): boolean {
		return true;
	}

	/**
	 * Performs any initialization tasks that need to be done before the service adapter can be used.
	 */
	async initialize(): Promise<void> {
		// Do nothing by default
	}

	/**
	 * Returns true if this service adapter can handle a given link.
	 */
	canHandleURL(link: string): boolean {
		return false;
	}

	/**
	 * Determines whether a given URL points to a collection of videos.
	 */
	isCollectionURL(url: string): boolean {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method isCollectionURL`
		);
	}

	/**
	 * Returns the video ID from a URL.
	 */
	getVideoId(url: string): string {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method getVideoId`
		);
	}

	/**
	 * Fetches video metadata from the API.
	 */
	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method fetchVideoInfo`
		);
	}

	/**
	 * Fetches video metadata for a list of IDs.
	 * @param requests List of objects with id and missingInfo keys
	 */
	async fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
		let videos: Video[] = [];
		for (let req of requests) {
			try {
				videos.push(await this.fetchVideoInfo(req.id, req.missingInfo));
			} catch (error) {
				log.warn(
					`fetchManyVideoInfo: failed to fetch ${this.serviceId}:${req.id}: ${error}, skipping`
				);
			}
		}
		return videos;
	}

	/**
	 * Fetches all videos associated with a URL.
	 */
	async resolveURL(
		url: string,
		properties?: (keyof VideoMetadata)[]
	): Promise<(Video | { url: string })[]> {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method resolveURL`
		);
	}

	/**
	 * Searches a video service.
	 * @param {string} query
	 */
	async searchVideos(query: string): Promise<Video[]> {
		return [];
	}
}
