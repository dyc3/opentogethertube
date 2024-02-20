import URL from "url";
import _ from "lodash";
import { ServiceAdapter } from "../serviceadapter";
import {
	LocalFileException,
	UnsupportedMimeTypeException,
	UnsupportedVideoType,
} from "../exceptions";
import { getMimeType, isSupportedMimeType } from "../mime";
import { getLogger } from "../logger";
import { Video } from "ott-common/models/video";
import { DashMPD } from "@liveinstantly/dash-mpd-parser";
import axios from "axios";
import { parseIso8601Duration } from "./parsing/iso8601";

const log = getLogger("dash");

export default class DashVideoAdapter extends ServiceAdapter {
	get serviceId(): "dash" {
		return "dash";
	}

	get isCacheSafe(): boolean {
		return false;
	}

	isCollectionURL(link: string): boolean {
		return false;
	}

	getVideoId(link: string): string {
		return link;
	}

	canHandleURL(link: string): boolean {
		const url = URL.parse(link);
		return /\/*\.(mpd)$/.test((url.path ?? "/").split("?")[0]);
	}

	async fetchVideoInfo(link: string): Promise<Video> {
		const url = URL.parse(link);
		if (url.protocol === "file:") {
			throw new LocalFileException();
		}
		const fileName = (url.pathname ?? "").split("/").slice(-1)[0].trim();
		const extension = fileName.split(".").slice(-1)[0];
		const mime = getMimeType(extension) ?? "unknown";
		if (!isSupportedMimeType(mime)) {
			throw new UnsupportedMimeTypeException(mime);
		}
		return await this.handleMpd(url);
	}

	async handleMpd(url: URL.UrlWithStringQuery): Promise<Video> {
		const resp = await axios.get(url.href);
		const mpd = new DashMPD();
		mpd.parse(resp.data);
		const manifest = mpd.getJSON();

		return this.parseMpdManifest(url, manifest);
	}

	parseMpdManifest(url: URL.UrlWithStringQuery, manifest: any): Video {
		// docs for how the parser works: https://github.com/liveinstantly/dash-mpd-parser

		log.debug(JSON.stringify(manifest));

		const durationRaw: string = manifest["MPD"]["@mediaPresentationDuration"];
		if (!durationRaw) {
			throw new UnsupportedVideoType("livestream");
		}
		const duration = parseIso8601Duration(durationRaw);

		const title = this.extractTitle(manifest);

		return {
			service: this.serviceId,
			id: url.href,
			title: title ?? url.pathname?.split("/").slice(-1)[0] ?? url.href,
			description: `Full Link: ${url.href}`,
			mime: "application/dash+xml",
			length: duration,
			dash_url: url.href,
		};
	}

	/**
	 * Attempts to find a title for the video from the manifest. Returns undefined if no title is found.
	 *
	 * Video metadata is not always available in the manifest, and it's not standardized, so this method will probably usually fail.
	 */
	extractTitle(manifest: any): string | undefined {
		try {
			if ("ProgramInformation" in manifest["MPD"]) {
				return manifest["MPD"]["ProgramInformation"]["Title"];
			}

			const periods = manifest["MPD"]["Period"];
			for (const period of periods) {
				const adaptationSets = period["AdaptationSet"];
				for (const adaptationSet of adaptationSets) {
					const representations = adaptationSet["Representation"];
					for (const representation of representations) {
						if ("Title" in representation) {
							return representation["Title"];
						}
					}
				}
			}
		} catch (e) {
			log.warn("Error extracting title from manifest", e);
		}

		return undefined;
	}
}
