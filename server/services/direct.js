const URL = require("url");
const _ = require("lodash");
const ServiceAdapter = require("../serviceadapter");
const { LocalFileException, UnsupportedMimeTypeException, MissingMetadataException } = require("../exceptions");
const { getMimeType, isSupportedMimeType } = require("../mime");
const ffprobe = require("../../ffprobe");
const { getLogger } = require("../../logger");
const Video = require("../../common/video");

const log = getLogger("direct");

class DirectVideoAdapter extends ServiceAdapter {
  static SERVICE_ID = "direct";

  get isCacheSafe() {
    return false;
  }

  isCollectionURL() {
    return false;
  }

  getVideoId(link) {
    return link;
  }

  canHandleLink(link) {
    const url = URL.parse(link);
    return /\/*\.(mp4(|v)|mpg4|webm|flv|mkv|avi|wmv|qt|mov|ogv|m4v|h26[1-4])$/.exec(
      url.path.split("?")[0]
    );
  }

  async fetchVideoInfo(link) {
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
    const video = new Video({
      service: this.serviceId,
      id: link,
      url: link,
      title: fileName,
      description: `Full Link: ${link}`,
      mime,
      length: Math.ceil(videoStream.duration),
    });

    return video;
  }
}

module.exports = DirectVideoAdapter;
