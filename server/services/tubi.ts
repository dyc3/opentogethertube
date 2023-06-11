import { URL } from "url";
import axios from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import { Video, VideoMetadata } from "common/models/video";
import { conf } from "../ott-config";

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

	get serviceId() {
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
		};
	}

	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		let resp = await this.api.get(`https://tubitv.com/oz/videos/${id}/content`);
		let data = resp.data as TubiVideoResponse;
		return this.extractVideo(data);
	}

	async fetchSeriesInfo(id: string): Promise<Video[]> {
		let resp = await this.api.get(`https://tubitv.com/series/${id}`);
		let match = /window\.__data\s*=\s*({.+?});\s*<\/script>/.exec(resp.data)?.[1];
		if (!match) {
			throw new Error(`Unable to get series info from ${id}`);
		}

		let corrected = match.split(":undefined").join(":null"); // because replaceAll isn't available here?
		let data = JSON.parse(corrected) as TubiSeriesInfo;

		let videos: Video[] = [];
		// sometimes the id has an extra zero prepended? weird
		let series = (data.video.byId[`0${id}`] ?? data.video.byId[id]) as TubiSeries;
		for (let season of series.seasons) {
			for (let episode of season.episodeIds) {
				let video = data.video.byId[episode] as TubiVideoResponse;
				videos.push(this.extractVideo(video));
			}
		}

		return videos;
	}

	async resolveURL(url: string): Promise<Video[]> {
		if (this.isCollectionURL(url)) {
			let path = new URL(url).pathname.split("/");
			return await this.fetchSeriesInfo(path[2]);
		} else {
			let id = this.getVideoId(url);
			return [await this.fetchVideoInfo(id)];
		}
	}
}
