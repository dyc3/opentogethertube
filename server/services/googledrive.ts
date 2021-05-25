import { URL } from "url";
import axios, { AxiosResponse } from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { ServiceLinkParseException, InvalidVideoIdException, OutOfQuotaException } from "../exceptions";
import { Video } from "../../common/models/video";
import { getLogger } from "../../logger";

const log = getLogger("googledrive");

interface GoogleDriveFile {
  id: string
  name: string
  thumbnailLink: string
  videoMediaMetadata: {
    durationMillis: number
  }
  mimeType: string
}

export default class GoogleDriveAdapter extends ServiceAdapter {
  apiKey: string
  api = axios.create({
    baseURL: "https://www.googleapis.com/drive/v3",
  });

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  get serviceId(): "googledrive" {
    return "googledrive";
  }

  canHandleURL(link: string): boolean {
    const url = new URL(link);
    return url.host.endsWith("drive.google.com");
  }

  isCollectionURL(link: string): boolean {
    const url = new URL(link);
    return this.isFolderURL(url);
  }

  isFolderURL(url) {
    return url.pathname.startsWith("/drive");
  }

  getVideoId(link: string): string {
    const url = new URL(link);
    return this.getVideoIdFromURL(url);
  }

  getFolderId(url: URL): string {
    if (/^\/drive\/u\/\d\/folders\//.exec(url.pathname)) {
      return url.pathname.split("/")[5].split("?")[0].trim();
    }
    else if (url.pathname.startsWith("/drive/folders")) {
      return url.pathname.split("/")[3].split("?")[0].trim();
    }
    else {
      throw new ServiceLinkParseException(this.serviceId, url.toString());
    }
  }

  getVideoIdFromURL(url: URL): string {
    if (url.pathname.startsWith("/file/d/")) {
      return url.pathname.split("/")[3];
    }
    else {
      return url.searchParams.get("id");
    }
  }

  async fetchVideoInfo(videoId: string): Promise<Video> {
    if (!/^[A-za-z0-9_-]+$/.exec(videoId)) {
      throw new InvalidVideoIdException(this.serviceId, videoId);
    }

    try {
      const result: AxiosResponse<GoogleDriveFile> = await this.api.get(`/files/${videoId}`, {
        params: {
          key: this.apiKey,
          fields: "id,name,mimeType,thumbnailLink,videoMediaMetadata(durationMillis)",
        },
      });

      const video = this.parseFile(result.data);
      return video;
    }
    catch (err) {
      if (err.response && err.response.data.error) {
        log.error(`Failed to get video metadata: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
      }
      throw err;
    }
  }

  async fetchFolderVideos(folderId: string): Promise<Video[]> {
    try {
      const result = await this.api.get("/files", {
        params: {
          key: this.apiKey,
          q: `${folderId}+in+parents`,
          fields: "files(id,name,mimeType,thumbnailLink,videoMediaMetadata(durationMillis))",
        },
      });
      log.info(`Found ${result.data.files.length} items in folder`);
      return result.data.files.map((item: GoogleDriveFile) => this.parseFile(item));
    }
    catch (err) {
      if (err.response && err.response.data.error && err.response.data.error.errors[0].reason === "dailyLimitExceeded") {
        throw new OutOfQuotaException(this.serviceId);
      }
      if (err.response && err.response.data.error) {
        log.error(`Failed to get google drive folder: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
      }
      throw err;
    }
  }

  async resolveURL(link: string): Promise<Video[]> {
    const url = new URL(link);

    if (this.isFolderURL(url)) {
      const folderId = this.getFolderId(url);
      return await this.fetchFolderVideos(folderId);
    }
    else {
      const videoId = this.getVideoIdFromURL(url);
      return [await this.fetchVideoInfo(videoId)];
    }
  }

  parseFile(file: GoogleDriveFile): Video {
    return {
      service: "googledrive",
      id: file.id,
      title: file.name,
      thumbnail: file.thumbnailLink,
      length: Math.ceil(file.videoMediaMetadata.durationMillis / 1000),
      mime: file.mimeType,
    };
  }
}

module.exports = GoogleDriveAdapter;
