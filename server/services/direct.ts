import URL from "url";
import _ from "lodash";
import { ServiceAdapter } from "../serviceadapter";
import {
	LocalFileException,
	UnsupportedMimeTypeException,
	MissingMetadataException,
} from "../exceptions";
import { getMimeType, isSupportedMimeType } from "../mime";
import { FfprobeStrategy, OnDiskPreviewFfprobe, RunFfprobe, StreamFfprobe } from "../ffprobe";
import { getLogger } from "../logger";
import { Video } from "ott-common/models/video";
import { conf } from "../ott-config";

const log = getLogger("direct");

export default class DirectVideoAdapter extends ServiceAdapter {
	ffprobe: FfprobeStrategy;

	constructor() {
		super();

		const ffprobeStrategy = conf.get("info_extractor.direct.ffprobe_strategy");
		switch (ffprobeStrategy) {
			case "stream":
				this.ffprobe = new StreamFfprobe();
				break;
			case "run":
				this.ffprobe = new RunFfprobe();
				break;
			case "disk":
				this.ffprobe = new OnDiskPreviewFfprobe();
				break;
			default:
				throw new Error(`Unknown ffprobe strategy: ${ffprobeStrategy}`);
		}
	}

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
		return /\/*\.(mp(3|4v?)|mpg4|webm|flv|mkv|avi|wmv|qt|mov|ogv|m4v|h26[1-4]|ogg)$/.test(
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
		const fileInfo = await this.ffprobe.getFileInfo(link);
		const duration = Math.ceil(this.getDuration(fileInfo));
		const title =
			fileInfo.format?.tags?.title ??
			decodeURIComponent(fileName).slice(0, -extension.length - 1);
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
}
