import { URL } from "node:url";
import axios, { type AxiosResponse } from "axios";
import { ServiceAdapter } from "../serviceadapter.js";
import { InvalidVideoIdException } from "../exceptions.js";
import type { Video } from "ott-common/models/video.js";
import { getLogger } from "../logger.js";

const log = getLogger("vimeo");
const VIMEO_VIDEO_PATH_REGEX = /^\/\d+$/;
const VIMEO_NUMERIC_ID_REGEX = /^\d+$/;

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

	get isCacheSafe(): boolean {
		return false;
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);
		const isVimeoHost = url.hostname === "vimeo.com" || url.hostname.endsWith(".vimeo.com");
		return isVimeoHost && VIMEO_VIDEO_PATH_REGEX.test(url.pathname);
	}

	isCollectionURL(link: string): boolean {
		return false;
	}

	getVideoId(link: string): string {
		const url = new URL(link);
		return url.pathname.split("/").slice(-1)[0].trim();
	}

	async fetchVideoInfo(videoId: string): Promise<Video> {
		if (!VIMEO_NUMERIC_ID_REGEX.test(videoId)) {
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
