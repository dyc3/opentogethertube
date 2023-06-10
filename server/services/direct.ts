import URL from "url";
import _ from "lodash";
import { ServiceAdapter } from "../serviceadapter";
import {
	LocalFileException,
	UnsupportedMimeTypeException,
	MissingMetadataException,
} from "../exceptions";
import { getMimeType, isSupportedMimeType } from "../mime";
import ffprobe from "../ffprobe";
import { getLogger } from "../logger";
import { Video } from "../../common/models/video";
import { Parser as M3u8Parser } from "m3u8-parser";
import axios from "axios";

const log = getLogger("direct");

export default class DirectVideoAdapter extends ServiceAdapter {
	get serviceId(): "direct" {
		return "direct";
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
		return /\/*\.(mp(3|4v?)|mpg4|webm|flv|mkv|avi|wmv|qt|mov|ogv|m4v|h26[1-4]|m3u8?|ogg)$/.test(
			(url.path ?? "/").split("?")[0]
		);
	}

	getDuration(fileInfo): number {
		const videoStream = _.find(fileInfo.streams, { codec_type: "video" });
		if (videoStream) {
			if (!videoStream.duration && !fileInfo.format.duration) {
				log.error("Video duration could not be determined");
				throw new MissingMetadataException();
			}
			return videoStream.duration ?? fileInfo.format.duration;
		} else {
			log.debug("No video stream found, assuming audio only");
			const audioStream = _.find(fileInfo.streams, { codec_type: "audio" });
			if (!audioStream) {
				log.error("Audio duration could not be determined");
				throw new MissingMetadataException();
			}
			return audioStream.duration ?? fileInfo.format.duration;
		}
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
		if (mime === "application/x-mpegURL") {
			return await this.handleM3u8(url);
		}
		const fileInfo = await ffprobe.getFileInfo(link);
		const duration = Math.ceil(this.getDuration(fileInfo));
		const title = fileInfo.format?.tags?.title ?? fileName;
		const video: Video = {
			service: this.serviceId,
			id: link,
			title,
			description: `Full Link: ${link}`,
			mime,
			length: duration,
		};

		return video;
	}

	/**
	 * @returns The link to the lowest bitrate video stream
	 */
	async handleM3u8(url: URL.UrlWithStringQuery): Promise<Video> {
		const parser = new M3u8Parser();
		const resp = await axios.get(url.href);

		// const entries: any[] = [];
		// parser.addParser({
		// 	expression: /^#EXT-X-I-FRAME-STREAM-INF/,
		// 	customType: 'iframes',
		// 	dataParser: (line: string) => {
		// 		const entry = {};
		// 		const attributes = line.replace('#EXT-X-I-FRAME-STREAM-INF:', '').split(',');
		// 		for (let attribute of attributes) {
		// 			const [key, value] = attribute.split('=');
		// 			entry[key] = value;
		// 		}
		// 		entries.push(entry);
		// 		return entries;
		// 	}
		//   });
		parser.push(resp.data);
		parser.end();
		const manifest = parser.manifest;
		log.silly(`Got m3u8 manifest with ${JSON.stringify(manifest)}`);

		const lowestBitratePlaylist = manifest.playlists.reduce((acc, cur) => {
			if (cur.attributes.BANDWIDTH < acc.attributes.BANDWIDTH) {
				return cur;
			} else {
				return acc;
			}
		}, { attributes: { BANDWIDTH: Infinity }});
		const newPath = url.pathname?.split("/").slice(0, -1).join("/") + "/" + lowestBitratePlaylist.uri;
		log.silly(`new playlist path ${newPath}`);
		const respStreams = await axios.get("https://" + url.hostname + newPath);
		const parser2 = new M3u8Parser();
		parser2.push(respStreams.data);
		parser2.end();
		const manifest2 = parser2.manifest;
		log.silly(`Got m3u8 manifest with ${JSON.stringify(manifest2)}`);



		return {
			service: this.serviceId,
			id: url.href,
			title: manifest2.attributes?.NAME ?? url.href,
			description: `Full Link: ${url.href}`,
			mime: "application/x-mpegURL",
			length: manifest2.segments.reduce((acc, cur) => acc + cur.duration, 0),
			hls_url: url.href,
		};
	}
}


module.exports = DirectVideoAdapter;
