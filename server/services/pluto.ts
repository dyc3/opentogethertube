import { URL } from "url";
import axios from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import type { Video, VideoMetadata, VideoService } from "../../common/models/video";
import { conf } from "../ott-config";
import { v1 as uuidv1 } from "uuid";

const log = getLogger("pluto");

export interface PlutoParsedIds {
	videoType: "series" | "movie";
	/** The series or movie ID */
	id: string;
	/** The episode ID, only present if videoType == "series" */
	subid?: string;
}

export interface PlutoParsedSlugs {
	videoType: "series" | "movie";
	/** The series or movie slug (its like a human readable id) */
	slug: string;
	/** The episode slug, only present if videoType == "series" */
	subslug?: string;
}

interface PlutoSlugsV3Response {
	_id: string;
	name: string;
	summary: string;
	description: string;
	/** units in milliseconds, probably */
	duration: number;
	featuredImage: {
		path: string;
	};
	stitched: {
		urls: {
			type: string;
			url: string;
		}[];
		sessionURL: string;
	};
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
		const path = parsed.pathname.split("/");
		let slug = path[4];
		let subslug: string | undefined;
		let videoType;
		if (path[3] === "series") {
			videoType = "series";
			subslug = path[8];
		} else if (path[3] === "movies") {
			videoType = "movie";
		} else {
			throw new Error(`Unable to parse video type from ${url}`);
		}

		return {
			videoType,
			id: slug,
			subid: subslug,
		};
	}

	videoIdToSlugs(id: string): PlutoParsedIds {
		const [slug, subslug] = id.split("/");
		return {
			videoType: subslug ? "series" : "movie",
			id: slug,
			subid: subslug,
		};
	}

	getVideoId(url: string): string {
		const parsed = this.parseUrl(url);
		return `${parsed.id}${parsed.subid ? `/${parsed.subid}` : ""}`;
	}

	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		// Functional info URLs:
		// produces good info, bad video url
		// - https://service-vod.clusters.pluto.tv/v3/vod/slugs/titanic-1997-1-1?deviceType=web
		// produces good m3u8 url:
		// - https://service-vod.clusters.pluto.tv/v3/vod/slugs/titanic-1997-1-1?deviceType=web&deviceModel=web&deviceMake=unknown&sid=201c47b0-1698-11ee-be56-0242ac120002
		// sid can any uuid v1

		const resp = await this.plutoBoot(id);
		const video = this.parseBootResponseIntoVideo(resp);

		return video;
	}

	async fetchSeriesInfo(id: string): Promise<Video[]> {
		throw new Error("Method not implemented.");
	}

	async resolveURL(url: string): Promise<Video[]> {
		throw new Error("Method not implemented.");
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

	parseBootResponseIntoVideo(resp: PlutoBootResponse): Video {
		const vod = resp.VOD[0];
		const video: Video = {
			service: this.serviceId,
			id: vod.id,
			title: vod.name,
			description: vod.description,
			thumbnail: vod.covers[0].url,
			length: vod.duration / 1000,
			hls_url: vod.stitched.path
				? `${resp.servers.stitcher}${vod.stitched.path}`
				: vod.stitched.paths?.find(p => p.type === "hls")?.path,
		};

		return video;
	}

	parseBootResponseIntoSlugs(resp: PlutoBootResponse): PlutoParsedSlugs {
		const vod = resp.VOD[0];

		return {
			videoType: vod.type as "series" | "movie",
			slug: vod.slug,
			// TODO: figure out what the subslug is for episodes
		};
	}
}

interface PlutoBootResponse {
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
	type: string;
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
