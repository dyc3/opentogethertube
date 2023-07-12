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
	streamingPlaylists: {
		id: number;
		playlistUrl: string;
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
		this.allowedHosts = conf.get("info_extractor.peertube.instances");
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

		if (conf.get("info_extractor.peertube.emit_as_direct")) {
			return this.parseAsDirect(result.data, host);
		} else {
			return this.parseVideoAsPeertube(result.data, host, id);
		}
	}

	parseVideoAsPeertube(peertubeVideo: PeertubeApiVideo, host: string, id: string): Video {
		const video: Video = {
			service: this.serviceId,
			id: `${host}:${id}`,
			title: peertubeVideo.name,
			description: peertubeVideo.description,
			length: peertubeVideo.duration,
			thumbnail: `https://${host}${peertubeVideo.thumbnailPath}`,
		};

		return video;
	}

	parseAsDirect(peertubeVideo: PeertubeApiVideo, host: string): Video {
		const base = {
			title: peertubeVideo.name,
			description: peertubeVideo.description,
			length: peertubeVideo.duration,
			thumbnail: `https://${host}${peertubeVideo.thumbnailPath}`,
		};

		if (peertubeVideo.streamingPlaylists.length > 0) {
			const playlist = peertubeVideo.streamingPlaylists[0];

			const video: Video = {
				service: "hls",
				id: playlist.playlistUrl,
				...base,
				hls_url: playlist.playlistUrl,
			};

			return video;
		} else if (peertubeVideo.files.length > 0) {
			const file =
				peertubeVideo.files.find(f => f.resolution.id === 1080) ?? peertubeVideo.files[0];

			const video: Video = {
				service: "direct",
				id: file.fileUrl,
				...base,
			};
			return video;
		} else {
			throw new Error("Unable to extract video URL from Peertube video");
		}
	}
}
