import { URL } from "url";
import axios from "axios";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import { Video, VideoMetadata } from "common/models/video";

interface TubiVideoResponse {
	id: string,
	title: string,
	description: string,
	thumbnails: string[],
	video_resources: {
		manifest: {
			url: string,
			duration: number,
		}
		type: string,
	}[]
}

export default class TubiAdapter extends ServiceAdapter {
	api = axios.create({
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	});

	get serviceId() {
		return 'tubi';
	}

	get isCacheSafe() {
		return false;
	}

	canHandleURL(link: string): boolean {
		return /https?:\/\/(?:www\.)?tubitv\.com\/(?:video|movies|tv-shows|oz\/videos)\/([0-9]+)/.test(link);
	}

	isCollectionURL(link: string): boolean {
		return link.includes("series");
	}

	getVideoId(url: string): string {
		const parsed = new URL(url);
		const path = parsed.pathname.split('/');
		if (path[1] === 'tv-shows' || path[1] === 'movies') {
			return path[2];
		}
		else if (path[1] === 'oz') {
			return path[3];
		}
		throw new Error(`Unable to get video id from ${url}`);
	}

	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		let resp = await this.api.get(`https://tubitv.com/oz/videos/${id}/content`);
		let data = resp.data as TubiVideoResponse;
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
}
