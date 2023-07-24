import { URL } from "url";
import axios from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import type { Video, VideoMetadata, VideoService } from "../../common/models/video";
import { conf } from "../ott-config";
import { v1 as uuidv1 } from "uuid";
import { InvalidVideoIdException } from "../exceptions";

const log = getLogger("pluto");

export interface PlutoParsedIds {
	type: "series" | "movies";
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
		const seriesMatch = parsed.pathname.match(/\/(movies|series)\/([a-z0-9]+)/);
		let videoType: "series" | "movies" | undefined = seriesMatch
			? (seriesMatch[1] as "series" | "movies")
			: undefined;
		let series = seriesMatch ? seriesMatch[2] : undefined;
		if (!videoType || !series) {
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
			type: videoType,
			id: series,
			subid: episode,
			season,
		};
	}

	videoIdToSlugs(id: string): PlutoParsedIds {
		if (!id.includes("/")) {
			throw new InvalidVideoIdException(this.serviceId, id);
		}
		const spl = id.split("/");
		const type = spl[0];
		const slug = spl[1];
		const subslug = spl[2];
		return {
			type: type as "series" | "movies",
			id: slug,
			subid: subslug,
		};
	}

	getVideoId(url: string): string {
		const parsed = this.parseUrl(url);
		return this.parsedIdsToVideoId(parsed);
	}

	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		const plutoIds = this.videoIdToSlugs(id);

		const resp = await this.plutoBoot(plutoIds.id);
		const video = this.parseBootResponseIntoVideo(plutoIds, resp);

		return video;
	}

	async fetchSeriesInfo(seriesId: string, season?: number): Promise<Video[]> {
		const resp = await this.plutoBoot(seriesId);
		const videos = this.parseBootResponseIntoSeries(resp, season);
		return videos;
	}

	async resolveURL(url: string): Promise<Video[]> {
		const plutoIds = this.parseUrl(url);

		const isCollection =
			plutoIds.type === "series" &&
			(plutoIds.subid === undefined || plutoIds.season !== undefined);

		if (isCollection) {
			return this.fetchSeriesInfo(plutoIds.id, plutoIds.season);
		} else {
			const videoId = this.parsedIdsToVideoId(plutoIds);
			return [await this.fetchVideoInfo(videoId)];
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

	parseBootResponseIntoVideo(plutoIds: PlutoParsedIds, resp: PlutoBootResponse): Video {
		if (!resp.servers.stitcher) {
			throw new Error("No stitcher server found in boot response");
		}

		let vodOrEpisode: Vod | Episode2 = resp.VOD[0];
		if (plutoIds.subid) {
			const ep = this.findEpisodeInVod(plutoIds.subid, vodOrEpisode);
			if (!ep) {
				throw new Error(
					`Unable to find episode ${plutoIds.subid} in VOD ${vodOrEpisode.id}`
				);
			}
			vodOrEpisode = ep;
		}

		const hlsUrl = new URL(
			resp.servers.stitcher + this.parseStitchedIntoHlsPath(vodOrEpisode.stitched)
		);
		hlsUrl.search = this.buildHlsQueryParams(resp).toString();
		const proxy = conf.get("cors_proxy");
		const cover = this.findBestCover(plutoIds.type, vodOrEpisode.covers);

		const video: Video = {
			service: this.serviceId,
			id: this.parsedIdsToVideoId(plutoIds),
			title: vodOrEpisode.name,
			description: vodOrEpisode.description,
			thumbnail: cover?.url,
			length: vodOrEpisode.duration / 1000,
			mime: "application/x-mpegURL",
			hls_url: proxy ? `https://${proxy}/${hlsUrl.toString()}` : hlsUrl.toString(),
		};

		return video;
	}

	parseBootResponseIntoSeries(resp: PlutoBootResponse, season?: number): Video[] {
		if (!resp.servers.stitcher) {
			throw new Error("No stitcher server found in boot response");
		}

		const vod = resp.VOD[0];
		const seasons = (vod.seasons ?? []).filter(s => !season || s.number === season);

		const videos: Video[] = [];
		for (const season of seasons) {
			let episodeNumber = 1;
			for (const episode of season.episodes) {
				const hlsUrl = new URL(
					resp.servers.stitcher + this.parseStitchedIntoHlsPath(episode.stitched)
				);
				hlsUrl.search = this.buildHlsQueryParams(resp).toString();
				const proxy = conf.get("cors_proxy");
				const cover = this.findBestCover("series", episode.covers);

				const video: Video = {
					service: this.serviceId,
					id: `series/${vod.id}/${episode._id}`,
					title: episode.name,
					description: `S${season.number}E${episodeNumber} - ${episode.description}`,
					thumbnail: cover?.url,
					length: episode.duration / 1000,
					mime: "application/x-mpegURL",
					hls_url: proxy ? `https://${proxy}/${hlsUrl.toString()}` : hlsUrl.toString(),
				};

				videos.push(video);
				episodeNumber++;
			}
		}

		return videos;
	}

	parseStitchedIntoHlsPath(stitched: Stitched2): string {
		if (stitched.path) {
			return stitched.path;
		}
		return stitched.paths?.find(p => p.type === "hls")?.path ?? "";
	}

	findEpisodeInVod(subid: string, vod: Vod): Episode2 | undefined {
		for (const season of vod.seasons ?? []) {
			for (const episode of season.episodes) {
				if (episode._id === subid) {
					return episode;
				}
			}
		}
	}

	parsedIdsToVideoId(parsed: PlutoParsedIds): string {
		return `${parsed.type}/${parsed.id}${parsed.subid ? `/${parsed.subid}` : ""}`;
	}

	findBestCover(type: "series" | "movies", covers: Cover[]): Cover | undefined {
		if (type === "series") {
			return covers.find(c => c.aspectRatio === "16:9") ?? covers[0];
		} else if (type === "movies") {
			return covers[0];
		} else {
			return covers[0];
		}
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
