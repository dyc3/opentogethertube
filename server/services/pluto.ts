import { URL } from "url";
import axios from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import { Video, VideoMetadata } from "common/models/video";
import { conf } from "../ott-config";

const log = getLogger("pluto");

export interface PlutoParsedSlugs {
	videoType: "series" | "movie";
	/** The series or movie ID */
	slug: string;
	/** The episode ID, only present if videoType == "series" */
	subslug?: string;
}

export default class PlutoAdapter extends ServiceAdapter {
	api = axios.create({
		headers: { "User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}` },
	});

	get serviceId() {
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

	parseUrl(url: string): PlutoParsedSlugs {
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
			slug,
			subslug,
		};
	}

	videoIdToSlugs(id: string): PlutoParsedSlugs {
		const [slug, subslug] = id.split("/");
		return {
			videoType: subslug ? "series" : "movie",
			slug,
			subslug,
		};
	}

	getVideoId(url: string): string {
		const parsed = this.parseUrl(url);
		return `${parsed.slug}${parsed.subslug ? `/${parsed.subslug}` : ""}`;
	}

	async fetchVideoInfo(id: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
		throw new Error("Method not implemented.");
	}

	async fetchSeriesInfo(id: string): Promise<Video[]> {
		throw new Error("Method not implemented.");
	}

	async resolveURL(url: string): Promise<Video[]> {
		throw new Error("Method not implemented.");
	}
}
