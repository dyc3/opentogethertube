import { URL } from "url";
import axios, { AxiosResponse } from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { InvalidVideoIdException } from "../exceptions";
import { Video } from "../../common/models/video";
import { getLogger } from "../logger";

const log = getLogger("vimeo");

interface VimeoApiVideo {
	title: string;
	description: string;
	thumbnail_url: string;
	duration: number;
}

export default class VimeoAdapter extends ServiceAdapter {
	api = axios.create({
		baseURL: "https://vimeo.com/api/oembed.json",
	});

	get serviceId(): "vimeo" {
		return "vimeo";
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);
		return url.host.endsWith("vimeo.com") && /^\/\d+$/.test(url.pathname);
	}

	isCollectionURL(link: string): boolean {
		return false;
	}

	getVideoId(link: string): string {
		const url = new URL(link);
		return url.pathname.split("/").slice(-1)[0].trim();
	}

	async fetchVideoInfo(videoId: string): Promise<Video> {
		if (!/^\d+$/.test(videoId)) {
			throw new InvalidVideoIdException(this.serviceId, videoId);
		}

		try {
			const result: AxiosResponse<VimeoApiVideo> = await this.api.get("", {
				params: {
					url: `https://vimeo.com/${videoId}`,
				},
			});

			const video: Video = {
				service: this.serviceId,
				id: videoId,
				title: result.data.title,
				description: result.data.description,
				thumbnail: result.data.thumbnail_url,
				length: result.data.duration,
			};

			return video;
		} catch (err) {
			if (err.response && err.response.status === 403) {
				log.error("Failed to get video info: Embedding for this video is disabled!");
			}
			throw err;
		}
	}
}

module.exports = VimeoAdapter;
