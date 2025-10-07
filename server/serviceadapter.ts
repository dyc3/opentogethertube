/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import {
	type Video,
	// biome-ignore lint/correctness/noUnusedImports: biome migration
	VideoId,
	type VideoMetadata,
	type VideoService,
} from "ott-common/models/video.js";
import { IncompleteServiceAdapterException } from "./exceptions.js";
import type { BulkVideoResult } from "./infoextractor.js";
import { getLogger } from "./logger.js";

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
	
// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
canHandleURL(link: string): boolean {
		return false;
	}

	/**
	 * Determines whether a given URL points to a collection of videos.
	 */
	
// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
isCollectionURL(url: string): boolean {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method isCollectionURL`
		);
	}

	/**
	 * Returns the video ID from a URL.
	 */
	
// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
getVideoId(url: string): string {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method getVideoId`
		);
	}

	/**
	 * Fetches video metadata from the API.
	 */
	
// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
async  fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method fetchVideoInfo`
		);
	}

	/**
	 * Fetches video metadata for a list of IDs.
	 * @param requests List of objects with id and missingInfo keys
	 */
	async fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
		const videos: Video[] = [];
		for (const req of requests) {
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
		// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
		url: string,
		// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
		properties?: (keyof VideoMetadata)[]
	): Promise<(Video | { url: string })[] | BulkVideoResult> {
		throw new IncompleteServiceAdapterException(
			`Service ${this.serviceId} does not implement method resolveURL`
		);
	}

	/**
	 * Searches a video service.
	 * @param {string} query
	 */
	
// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
async  searchVideos(query: string): Promise<Video[]> {
		return [];
	}
}
