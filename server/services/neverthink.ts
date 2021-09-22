import _ from "lodash";
import { URL } from "url";
import axios, { AxiosResponse } from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { Video, VideoId } from "../../common/models/video";
import { getLogger } from "../../logger";

const log = getLogger("neverthink");

type NeverthinkApiVideo = NeverthinkApiVideoYt | NeverthinkApiVideoNt

interface NeverthinkApiVideoBase {
	origin: string
	title: string
	description: string
	duration: number
	thumbnailUrl: string
}

interface NeverthinkApiVideoYt extends NeverthinkApiVideoBase {
	origin: "yt"
	id: string
}

interface NeverthinkApiVideoNt extends NeverthinkApiVideoBase {
	origin: "nt"
	originalVideoId: string
}

interface NeverthinkChannelSummary {
	id: number
	urlFragment: string
	playlist: {
		url: string
		urlPlain: string
	}
}

interface NeverthinkChannelFull {
	id: number
	slug: string
	youtubeUrl: string
	videos?: NeverthinkApiVideo[]
}

export default class NeverthinkAdapter extends ServiceAdapter {
	api = axios.create({
		baseURL: "https://neverthink.tv/api/v5/public",
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	});
	fetch = axios.create({
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	})

	get serviceId(): "neverthink" {
		return "neverthink";
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);
		return (url.host.endsWith("neverthink.tv") || url.host.endsWith("neverth.ink")) && url.pathname.length > 1;
	}

	isCollectionURL(link: string): boolean {
		const url = new URL(link);
		return !url.pathname.startsWith("/v/");
	}

	getVideoId(link: string): string {
		const url = new URL(link);
		return url.pathname.replace("/v/", "");
	}

	async fetchVideoInfo(id: string): Promise<Video> {
		const resp = await this.api.get(`/videos/${id}`);
		return this.parseVideo(resp.data);
	}

	async resolveURL(link: string): Promise<Video[]> {
		const url = new URL(link);
		if (url.pathname.startsWith("/v/")) {
			const id = this.getVideoId(link);
			return [await this.fetchVideoInfo(id)];
		}
		else if (url.pathname.startsWith("/u/")) {
			const user = url.pathname.replace("/u/", "");
			return this.getUserChannel(user);
		}
		else if (url.pathname.startsWith("/playlists/") || url.pathname.endsWith(".json")) {
			const resp = await this.fetch.get(link);
			// HACK: limit the possible array size to 50, because you can't request more than 50 videos at a time from youtube
			return resp.data.videos.slice(0, 50).map((vid: string) => {
				if (vid.startsWith("nt:")) {
					const ytid: string | undefined = vid.split(":")[2];
					if (ytid) {
						return {
							service: "youtube",
							id: ytid,
						};
					}
					else {
						return;
					}
				}
				else if (vid.startsWith("vimeo:")) {
					const vimeoid = vid.split(":")[1];
					return {
						service: "vimeo",
						id: vimeoid,
					};
				}
				else {
					return {
						service: "youtube",
						id: vid,
					};
				}
			}).filter((vid: VideoId | undefined) => !!vid);
		}
		else {
			const channels = await this.getAllChannels();
			const playlistUrl = _.find(channels, { urlFragment: url.pathname.split("/").slice(-1)[0] })?.playlist.urlPlain;
			if (playlistUrl) {
				log.info(`found playlist URL: ${playlistUrl}`);
				return this.resolveURL(playlistUrl);
			}
		}
		throw new Error("Unable to resolve URL");
	}

	parseVideo(data: NeverthinkApiVideo): Video {
		let sid: Video;
		if (data.origin === "yt") {
			log.info("found youtube origin at neverthink link");
			sid = {
				service: "youtube",
				id: data.id,
			};
		}
		else if (data.origin === "nt") {
			log.info("found neverthink origin at neverthink link, but it links back to a youtube video");
			sid = {
				service: "youtube",
				id: data.originalVideoId,
			};
		}
		else {
			throw new Error("Unable to parse video");
		}
		return {
			...sid,
			title: data.title,
			description: data.description,
			length: data.duration,
			thumbnail: data.thumbnailUrl,
		};
	}

	/**
	 * Get videos from a neverthink user's channel.
	 */
	async getUserChannel(user: string): Promise<Video[]> {
		const resp: AxiosResponse<NeverthinkChannelFull> = await this.api.get(`/users/${user}?include=videos`);
		return resp.data.videos?.slice(0, 50).map(this.parseVideo) ?? [];
	}

	async getAllChannels(): Promise<NeverthinkChannelSummary[]> {
		const resp: AxiosResponse<{ channels: NeverthinkChannelSummary[] }> = await this.api.get("/init");
		return resp.data.channels;
	}
}

module.exports = NeverthinkAdapter;
