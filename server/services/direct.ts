import URL from "url";
import _ from "lodash";
import { ServiceAdapter } from "../serviceadapter";
import { LocalFileException, UnsupportedMimeTypeException, MissingMetadataException } from "../exceptions";
import { getMimeType, isSupportedMimeType } from "../mime";
import ffprobe from "../../ffprobe";
import { getLogger } from "../../logger";
import { VideoDirect } from "../../common/models/video";

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
    return /\/*\.(mp4(|v)|mpg4|webm|flv|mkv|avi|wmv|qt|mov|ogv|m4v|h26[1-4])$/.test(
      url.path.split("?")[0]
    );
  }

  async fetchVideoInfo(link: string): Promise<VideoDirect> {
    const url = URL.parse(link);
    if (url.protocol === "file:") {
      throw new LocalFileException();
    }
    const fileName = url.pathname.split("/").slice(-1)[0].trim();
    const extension = fileName.split(".").slice(-1)[0];
    const mime = getMimeType(extension);
    if (!isSupportedMimeType(mime)) {
      throw new UnsupportedMimeTypeException(mime);
    }
    const fileInfo = await ffprobe.getFileInfo(link);
    const videoStream = _.find(fileInfo.streams, { codec_type: "video" });
    if (!videoStream.duration) {
      log.error("Video duration could not be determined");
      throw new MissingMetadataException();
    }
    const video: VideoDirect = {
      service: this.serviceId,
      id: link,
      title: fileName,
      description: `Full Link: ${link}`,
      mime,
      length: Math.ceil(videoStream.duration),
    };

    return video;
  }
}

module.exports = DirectVideoAdapter;
