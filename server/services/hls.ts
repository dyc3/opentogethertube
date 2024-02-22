import URL from "url";
import _ from "lodash";
import { ServiceAdapter } from "../serviceadapter";
import { LocalFileException, UnsupportedMimeTypeException } from "../exceptions";
import { getMimeType, isSupportedMimeType } from "../mime";
import { getLogger } from "../logger";
import { Video } from "../../common/models/video";
import { Parser as M3u8Parser } from "m3u8-parser";
import axios from "axios";
import { OttException } from "../../common/exceptions";

const log = getLogger("hls");

export default class HlsVideoAdapter extends ServiceAdapter {
	get serviceId(): "hls" {
		return "hls";
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
		return /\/*\.(m3u8?)$/.test((url.path ?? "/").split("?")[0]);
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
		return await this.handleM3u8(url);
	}

	async handleM3u8(url: URL.UrlWithStringQuery): Promise<Video> {
		const parser = new M3u8Parser();
		const resp = await axios.get(url.href);
		parser.push(resp.data);
		parser.end();
		const manifest = parser.manifest;
		// log.silly(`Got m3u8 manifest with ${JSON.stringify(manifest)}`);

		if (manifest.playlists.length === 0) {
			throw new M3u8ParseError("No playlists found in manifest");
		}

		const lowestBitratePlaylist = manifest.playlists.reduce(
			(acc, cur) => {
				if (cur.attributes.BANDWIDTH < acc.attributes.BANDWIDTH) {
					return cur;
				} else {
					return acc;
				}
			},
			{ attributes: { BANDWIDTH: Infinity } }
		);
		const newPath =
			url.pathname?.split("/").slice(0, -1).join("/") + "/" + lowestBitratePlaylist.uri;
		log.silly(`new playlist path ${newPath}`);
		const respStreams = await axios.get("https://" + url.hostname + newPath);
		const parser2 = new M3u8Parser();
		parser2.push(respStreams.data);
		parser2.end();
		const manifest2 = parser2.manifest;
		// log.silly(`Got m3u8 manifest with ${JSON.stringify(manifest2)}`);

		const duration = manifest2.segments.reduce((acc, cur) => acc + cur.duration, 0);
		if (duration === 0) {
			throw new M3u8ParseError("Duration of the selected playlist is 0");
		}

		return {
			service: "hls",
			id: url.href,
			title: manifest2.attributes?.NAME ?? url.href,
			description: `Full Link: ${url.href}`,
			mime: "application/x-mpegURL",
			length: duration,
			hls_url: url.href,
		};
	}
}

export class M3u8ParseError extends OttException {
	constructor(public readonly message: string) {
		super(message);
		this.name = "M3u8ParseError";
	}
}
