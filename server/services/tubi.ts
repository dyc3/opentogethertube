import axios from "axios";
import type { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { URL } from "url";
import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import { ServiceAdapter } from "../serviceadapter.js";

const log = getLogger("tubi");

interface TubiVideoResponse {
	id: string;
	type: "k";
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
		return /https?:\/\/(?:www\.)?tubitv\.com\/(?:video|movies|tv-shows|oz\/videos|series)\/([0-9]+)/.test(
			link
		);
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

	async fetchVideoInfo(id: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		if (!/^\d+$/.test(id)) {
			throw new Error(`Invalid Tubi video id: ${id}`);
		}
		const resp = await this.api.get(`https://tubitv.com/oz/videos/${id}/content`);
		const data = resp.data as TubiVideoResponse;
		return this.extractVideo(data);
	}

	async fetchSeriesInfo(id: string): Promise<Video[]> {
		if (!/^\d+$/.test(id)) {
			throw new Error(`Invalid Tubi series id: ${id}`);
		}
		const resp = await this.api.get(`https://tubitv.com/series/${id}`);
		const match = /window\.__data\s*=\s*({.+?});\s*<\/script>/.exec(resp.data)?.[1];
		if (!match) {
			throw new Error(`Unable to get series info from ${id}`);
		}

		const corrected = match.split(":undefined").join(":null"); // because replaceAll isn't available here?
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
