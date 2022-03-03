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
		const fileInfo = await ffprobe.getFileInfo(link);
		const duration = Math.ceil(this.getDuration(fileInfo));
		const video: Video = {
			service: this.serviceId,
			id: link,
			title: fileName,
			description: `Full Link: ${link}`,
			mime,
			length: duration,
		};

		return video;
	}
}

module.exports = DirectVideoAdapter;
