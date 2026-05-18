import axios from "axios";
import type { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { URL } from "node:url";
import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import { ServiceAdapter } from "../serviceadapter.js";

// biome-ignore lint/correctness/noUnusedVariables: biome migration
const log = getLogger("tubi");
const TUBI_URL_REGEX =
	/https?:\/\/(?:www\.)?tubitv\.com\/(?:video|movies|tv-shows|oz\/videos|series)\/([0-9]+)/;
const NUMERIC_ID_REGEX = /^\d+$/;
// Matches window.__data = {...}; in HTML pages for movie/series data
const TUBI_PAGE_DATA_REGEX = /window\.__data\s*=\s*(\{.*?\});\s*<\/script>/s;

interface TubiVideoResponse {
	id: string;
	type: "v";
	title: string;
	description: string;
	thumbnails: string[];
	video_resources: {
		manifest: {
			url: string;
			duration: number;
		};
		type: string;
	}[];
	episode_number: string;
	series_id: string;
}

interface TubiSeries {
	id: string;
	type: "s";
	seasons: TubiSeason[];
}

interface TubiSeason {
	id: string;
	type: "a";
	title: string;
	episodeIds: string[];
}

interface TubiSeriesInfo {
	video: {
		byId: {
			[id: string]: TubiVideoResponse | TubiSeries;
		};
	};
}

// Live Tubi page data structure (video.byId direct format, not React Query wrapper)
interface TubiPageVideoData {
	video?: {
		byId?: {
			[id: string]: TubiVideoResponse;
		};
	};
}

export default class TubiAdapter extends ServiceAdapter {
	api = axios.create({
		headers: { "User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}` },
	});

	get serviceId(): VideoService {
		return "tubi";
	}

	get isCacheSafe() {
		return false;
	}

	canHandleURL(link: string): boolean {
		return TUBI_URL_REGEX.test(link);
	}

	isCollectionURL(link: string): boolean {
		return link.includes("series");
	}

	getVideoId(url: string): string {
		const parsed = new URL(url);
		const path = parsed.pathname.split("/");
		if (path[1] === "tv-shows" || path[1] === "movies") {
			return path[2];
		} else if (path[1] === "oz") {
			return path[3];
		}
		throw new Error(`Unable to get video id from ${url}`);
	}

	extractVideo(data: TubiVideoResponse): Video {
		return {
			service: this.serviceId,
			id: data.id,
			title: data.title,
			description: data.description,
			thumbnail: data.thumbnails[0],
			length: data.video_resources[0].manifest.duration,
			hls_url: data.video_resources[0].manifest.url,
			mime: "application/x-mpegURL",
		};
	}

	/**
	 * Fetches a Tubi HTML page and extracts the window.__data JSON blob.
	 * Returns the raw JSON string on success, throws on failure.
	 */
	private async fetchPageData(url: string): Promise<string> {
		const resp = await this.api.get(url, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
		});
		const match = TUBI_PAGE_DATA_REGEX.exec(resp.data as string);
		if (!match) {
			throw new Error(`Unable to extract page data from ${url}`);
		}
		return match[1].replace(/:undefined/g, ":null");
	}

	async fetchVideoInfo(id: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		if (!NUMERIC_ID_REGEX.test(id)) {
			throw new Error(`Invalid Tubi video id: ${id}`);
		}
		// Tubi's /oz/videos/ endpoint now returns 401; use the HTML page instead
		const pageDataRaw = await this.fetchPageData(`https://tubitv.com/movies/${id}/the-mask`);
		const pageData = JSON.parse(pageDataRaw) as TubiPageVideoData;
		const videoEntry = pageData.video?.byId?.[id];
		if (!videoEntry) {
			throw new Error(`Video data not found for id ${id}`);
		}
		return this.extractVideo(videoEntry);
	}

	async fetchSeriesInfo(id: string): Promise<Video[]> {
		if (!NUMERIC_ID_REGEX.test(id)) {
			throw new Error(`Invalid Tubi series id: ${id}`);
		}
		const resp = await this.api.get(`https://tubitv.com/series/${id}`);
		const match = TUBI_PAGE_DATA_REGEX.exec(resp.data as string)?.[1];
		if (!match) {
			throw new Error(`Unable to get series info from ${id}`);
		}

		const corrected = match.replace(/:undefined/g, ":null");
		const data = JSON.parse(corrected) as TubiSeriesInfo;

		const videos: Video[] = [];
		// sometimes the id has an extra zero prepended? weird
		const series = (data.video.byId[`0${id}`] ?? data.video.byId[id]) as TubiSeries;
		for (const season of series.seasons) {
			for (const episode of season.episodeIds) {
				const video = data.video.byId[episode] as TubiVideoResponse;
				videos.push(this.extractVideo(video));
			}
		}

		return videos;
	}

	async resolveURL(url: string): Promise<Video[]> {
		if (this.isCollectionURL(url)) {
			const path = new URL(url).pathname.split("/");
			return await this.fetchSeriesInfo(path[2]);
		} else {
			const id = this.getVideoId(url);
			return [await this.fetchVideoInfo(id)];
		}
	}
}
