import axios, { type AxiosResponse } from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { conf } from "../ott-config";
import { Video } from "ott-common/models/video";

interface PeertubeApiVideo {
	uuid: string;
	shortUUID: string;
	name: string;
	truncatedDescription: string;
	description: string;
	duration: number;
	thumbnailPath: string;
	files: {
		id: number;
		resolution: {
			id: number;
			label: string;
		};
		fileUrl: string;
	}[];
}

export default class PeertubeAdapter extends ServiceAdapter {
	api = axios.create({
		headers: { "User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}` },
	});

	allowedHosts: string[] = [];

	get serviceId(): "peertube" {
		return "peertube";
	}

	get isCacheSafe(): boolean {
		return false;
	}

	async initialize(): Promise<void> {
		// TODO: fetch instances from https://instances.joinpeertube.org/api/v1/instances?start=0&count=100&sort=-totalVideos maybe?

		this.allowedHosts = ["the.jokertv.eu", "tube.shanti.cafe", "comics.peertube.biz"];
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);
		return this.allowedHosts.includes(url.host) && /^\/w\/\w+/.test(url.pathname);
	}

	isCollectionURL(link: string): boolean {
		return false;
	}

	getVideoId(link: string): string {
		const url = new URL(link);
		return `${url.host}:${url.pathname.split("/").slice(-1)[0].trim()}`;
	}

	async fetchVideoInfo(videoId: string): Promise<Video> {
		const [host, id] = videoId.split(":");

		const result: AxiosResponse<PeertubeApiVideo> = await this.api.get(
			`https://${host}/api/v1/videos/${id}`
		);

		const video: Video = {
			service: this.serviceId,
			id: videoId,
			title: result.data.name,
			description: result.data.description,
			length: result.data.duration,
			thumbnail: `https://${host}${result.data.thumbnailPath}`,
		};

		return video;
	}
}
