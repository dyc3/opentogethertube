import { URL } from "url";
import axios from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import type { Video, VideoMetadata, VideoService } from "../../common/models/video";
import { conf } from "../ott-config";
import { v1 as uuidv1 } from "uuid";

const log = getLogger("pluto");

export interface PlutoParsedIds {
	/** The series or movie ID */
	id: string;
	/** The episode ID, only present if videoType == "series" */
	subid?: string;
	/** The season number, only present if videoType == "series" */
	season?: number;
}

export default class PlutoAdapter extends ServiceAdapter {
	api = axios.create({
		headers: { "User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}` },
	});
	clientId = uuidv1();

	get serviceId(): VideoService {
		return "pluto";
	}

	get isCacheSafe() {
		return false;
	}

	canHandleURL(link: string): boolean {
		return /https?:\/\/(www\.)?pluto\.tv\/[a-z]{2}\/on-demand\/(movies|series)\/(.*)\/?$/.test(
			link
		);
	}

	isCollectionURL(link: string): boolean {
		return !link.includes("episode") && !link.includes("movies");
	}

	parseUrl(url: string): PlutoParsedIds {
		const parsed = new URL(url);
		const seriesMatch = parsed.pathname.match(/\/(?:movies|series)\/([a-z0-9]+)/);
		let series = seriesMatch ? seriesMatch[1] : undefined;
		if (!series) {
			throw new Error(`Unable to parse series from ${url}`);
		}
		let episode: string | undefined;
		const episodeMatch = parsed.pathname.match(/episode\/([a-z0-9]+)/);
		if (episodeMatch) {
			episode = episodeMatch[1];
		}
		let season: number | undefined;
		if (!episodeMatch) {
			const seasonMatch = parsed.pathname.match(/season\/(\d+)/);
			if (seasonMatch) {
				season = parseInt(seasonMatch[1]);
			}
		}

		return {
			id: series,
			subid: episode,
			season,
		};
	}

	videoIdToSlugs(id: string): PlutoParsedIds {
		if (!id.includes("/")) {
			return {
				id,
			};
		}
		const [slug, subslug] = id.split("/");
		return {
			id: slug,
			subid: subslug,
		};
	}

	getVideoId(url: string): string {
		const parsed = this.parseUrl(url);
		return `${parsed.id}${parsed.subid ? `/${parsed.subid}` : ""}`;
	}

	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		const plutoIds = this.videoIdToSlugs(id);

		const resp = await this.plutoBoot(plutoIds.id);
		const video = this.parseBootResponseIntoVideo(resp);

		return video;
	}

	async fetchSeriesInfo(seriesId: string, season?: number): Promise<Video[]> {
		const resp = await this.plutoBoot(seriesId);
		const videos = this.parseBootResponseIntoSeries(resp, season);
		return videos;
	}

	async resolveURL(url: string): Promise<Video[]> {
		const plutoIds = this.parseUrl(url);

		const isCollection = plutoIds.subid === undefined && plutoIds.season !== undefined;

		if (isCollection) {
			return this.fetchSeriesInfo(plutoIds.id, plutoIds.season);
		} else {
			if (plutoIds.subid) {
				return [await this.fetchVideoInfo(`${plutoIds.id}/${plutoIds.subid}`)];
			}
			return [await this.fetchVideoInfo(plutoIds.id)];
		}
	}

	async plutoBoot(seriesId: string): Promise<PlutoBootResponse> {
		// Sample requests: GET https://boot.pluto.tv/v4/start?appName=web&appVersion=7.3.0-61c941df65e64c5f6a98944137c6e21c21cef2e7&deviceVersion=113.0.0&deviceModel=web&deviceMake=firefox&deviceType=web&clientID=7380ddc0-4922-47de-858d-8c4c8d6dc092&clientModelNumber=1.0.0&episodeSlugs=titanic-1997-1-1&serverSideAds=false&constraints=&drmCapabilities=widevine:L3&blockingMode=&clientTime=2023-06-29T16:28:42.362Z
		const resp = await this.api.get("https://boot.pluto.tv/v4/start", {
			params: {
				appName: "web",
				appVersion: "7.3.0-61c941df65e64c5f6a98944137c6e21c21cef2e7",
				clientModelNumber: "1.0.0",
				clientID: this.clientId,
				deviceMake: "unknown",
				deviceModel: "web",
				deviceType: "web",
				seriesIds: seriesId,
			},
		});

		log.debug(`Pluto boot response ${resp.status}`);
		log.silly(`Pluto boot response ${JSON.stringify(resp.data)}`);

		return resp.data as PlutoBootResponse;
	}

	buildHlsQueryParams(resp: PlutoBootResponse): URLSearchParams {
		const params = new URLSearchParams();
		params.set("appName", "web");
		params.set("appVersion", "7.3.0-61c941df65e64c5f6a98944137c6e21c21cef2e7");
		params.append("deviceDNT", "1");
		params.append("deviceType", "web");
		params.append("deviceModel", "web");
		params.append("deviceMake", "unknown");
		params.append("deviceId", uuidv1());
		params.append("deviceVersion", "1");
		params.append("sid", resp.session.sessionID);
		return params;
	}

	parseBootResponseIntoVideo(resp: PlutoBootResponse): Video {
		const vod = resp.VOD[0];
		const hlsUrl = new URL(
			resp.servers.stitcher +
				(vod.stitched.path
					? `${vod.stitched.path}`
					: vod.stitched.paths?.find(p => p.type === "hls")?.path ?? "")
		);
		hlsUrl.search = this.buildHlsQueryParams(resp).toString();
		const proxy = conf.get("cors_proxy");

		const video: Video = {
			service: this.serviceId,
			id: vod.id,
			title: vod.name,
			description: vod.description,
			thumbnail: vod.covers[0].url,
			length: vod.duration / 1000,
			mime: "application/x-mpegURL",
			hls_url: proxy ? `https://${proxy}/${hlsUrl.toString()}` : hlsUrl.toString(),
		};

		return video;
	}

	parseBootResponseIntoSeries(resp: PlutoBootResponse, season?: number): Video[] {
		const vod = resp.VOD[0];
		const seasons = (vod.seasons ?? []).filter(s => !season || s.number === season);

		const videos: Video[] = [];
		for (const season of seasons) {
			for (const episode of season.episodes) {
				const hlsUrl = new URL(
					resp.servers.stitcher +
						(episode.stitched.path
							? `${episode.stitched.path}`
							: episode.stitched.paths?.find(p => p.type === "hls")?.path ?? "")
				);
				hlsUrl.search = this.buildHlsQueryParams(resp).toString();
				const proxy = conf.get("cors_proxy");

				const video: Video = {
					service: this.serviceId,
					id: `${vod.id}/${episode._id}`,
					title: episode.name,
					description: episode.description,
					thumbnail: episode.covers[0].url,
					length: episode.duration / 1000,
					mime: "application/x-mpegURL",
					hls_url: proxy ? `https://${proxy}/${hlsUrl.toString()}` : hlsUrl.toString(),
				};

				videos.push(video);
			}
		}

		return videos;
	}
}

export interface PlutoBootResponse {
	servers: {
		stitcher: string;
	};
	features: unknown;
	session: Session;
	EPG: Epg[];
	VOD: Vod[];
	notifications: unknown[];
	ratings: unknown;
	ratingDescriptors: unknown;
	startingChannel: unknown;
	stitcherParams: string;
	serverTime: string;
	refreshInSec: number;
	sessionToken: string;
}

interface Session {
	sessionID: string;
	clientIP: string;
	countryCode: string;
	activeRegion: string;
	city: string;
	postalCode: string;
	preferredLanguage: string;
	deviceType: string;
	deviceMake: string;
	deviceModel: string;
	logLevel: string;
	clientDeviceType: number;
	marketingRegion: string;
	restartThresholdMS: number;
}

interface Epg {
	name: string;
	id: string;
	isStitched: boolean;
	slug: string;
	categoryIDs: string[];
	stitched: Stitched;
	images: Image[];
	number: number;
	timelines: Timeline[];
}

interface Stitched {
	paths: Path[];
}

interface Path {
	type: string;
	path: string;
}

interface Image {
	type: string;
	style: string;
	ratio: number;
	defaultWidth: number;
	defaultHeight: number;
	url: string;
}

interface Timeline {
	start: string;
	stop: string;
	title: string;
	_id: string;
	episode: Episode;
}

interface Episode {
	_id: string;
	name: string;
	rating: string;
	originalContentDuration: number;
	genre: string;
	description: string;
	slug: string;
	series: Series;
	distributeAs: DistributeAs;
}

interface Series {
	_id: string;
	name: string;
	slug: string;
	type: string;
}

interface DistributeAs {
	AVOD: boolean;
}
interface Vod {
	type: string;
	id: string;
	name: string;
	description: string;
	duration: number;
	slug: string;
	rating: string;
	genre: string;
	stitched: Stitched2;
	covers: Cover[];
	seriesID: string;
	categoryID: string;
	seasons?: Season[];
}

interface Season {
	number: number;
	episodes: Episode2[];
}

interface Episode2 {
	_id: string;
	name: string;
	description: string;
	duration: number;
	slug: string;
	rating: string;
	genre: string;
	stitched: Stitched2;
	covers: Cover[];
	seriesID: string;
	categoryID: string;
	type: "episode";
}

interface Stitched2 {
	path?: string;
	paths?: Path2[];
}

interface Path2 {
	type: string;
	path: string;
}

interface Cover {
	aspectRatio: string;
	url: string;
}
