import URL from "url";
import _ from "lodash";
import { ServiceAdapter } from "../serviceadapter.js";
import {
	LocalFileException,
	UnsupportedMimeTypeException,
	MissingMetadataException,
} from "../exceptions.js";
import { getMimeType, isSupportedMimeType } from "../mime.js";
import {
	type FfprobeStrategy,
	OnDiskPreviewFfprobe,
	RunFfprobe,
	StreamFfprobe,
} from "../ffprobe.js";
import { getLogger } from "../logger.js";
import type { Video } from "ott-common/models/video.js";
import { conf } from "../ott-config.js";

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

	/**
	 * Maps ffprobe format names to MIME types.
	 */
	getMimeFromFormat(formatName: string): string | undefined {
		// ffprobe format_name can contain multiple comma-separated values
		const formats = formatName.split(",");
		const formatToMime: Record<string, string> = {
			mp4: "video/mp4",
			mov: "video/quicktime",
			matroska: "video/x-matroska",
			webm: "video/webm",
			avi: "video/x-msvideo",
			flv: "video/x-flv",
			ogg: "video/ogg",
			mp3: "audio/mpeg",
			wav: "audio/x-wav",
			aac: "audio/aac",
			flac: "audio/flac",
		};
		const matchedFormat = formats.find(format => formatToMime[format]);
		return matchedFormat ? formatToMime[matchedFormat] : undefined;
	}

	async fetchVideoInfo(link: string): Promise<Video> {
		const url = URL.parse(link);
		if (url.protocol === "file:") {
			throw new LocalFileException();
		}
		const fileName = (url.pathname ?? "").split("/").slice(-1)[0].trim();
		const extension = fileName.split(".").slice(-1)[0];
		let mime = getMimeType(extension);

		// If we can't determine a supported MIME type from extension, use ffprobe to detect it
		const fileInfo = await this.ffprobe.getFileInfo(link);

		if (!mime || !isSupportedMimeType(mime)) {
			// Try to get MIME type from ffprobe format info
			const formatName = fileInfo.format?.format_name;
			if (formatName) {
				const formatMime = this.getMimeFromFormat(formatName);
				if (formatMime && isSupportedMimeType(formatMime)) {
					mime = formatMime;
				}
			}
		}

		// Final fallback: check if we have video/audio streams and use a generic supported MIME type
		if (!mime || !isSupportedMimeType(mime)) {
			const hasVideo = fileInfo.streams?.some(
				(s: { codec_type: string }) => s.codec_type === "video"
			);
			const hasAudio = fileInfo.streams?.some(
				(s: { codec_type: string }) => s.codec_type === "audio"
			);
			// Use generic MIME types that are known to be supported
			if (hasVideo) {
				mime = "video/mp4";
			} else if (hasAudio) {
				mime = "audio/mpeg";
			}
		}

		if (!mime || !isSupportedMimeType(mime)) {
			throw new UnsupportedMimeTypeException(mime ?? "unknown");
		}

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
