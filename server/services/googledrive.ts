import { URL } from "url";
import axios, { AxiosError, AxiosResponse } from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { ServiceLinkParseException, InvalidVideoIdException, OutOfQuotaException } from "../exceptions";
import { Video } from "../../common/models/video";
import { getLogger } from "../logger";

const log = getLogger("googledrive");

interface GoogleDriveFile {
  "kind": "drive#file",
  id: string
  name: string
  thumbnailLink: string
  videoMediaMetadata: {
    durationMillis: number
  }
  mimeType: string
}

interface GoogleDriveListResponse {
  kind: "drive#fileList",
  nextPageToken: string,
  incompleteSearch: boolean,
  files: GoogleDriveFile[],
}

interface GoogleDriveErrorResponse {
  error: {
    message: string,
    errors: { reason: string }[],
  }
}

function isGoogleDriveApiError(response: AxiosResponse<any> | undefined): response is AxiosResponse<GoogleDriveErrorResponse> {
  return !!response && "error" in response.data;
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
      return url.searchParams.get("id") ?? "";
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
      if (axios.isAxiosError(err) && isGoogleDriveApiError(err.response)) {
        log.error(`Failed to get video metadata: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
      }
      else if (err instanceof Error) {
        log.error(`Failed to get video metadata: ${err.message} ${err.stack}`);
      }
      else {
        log.error(`Failed to get video metadata`);
      }
      throw err;
    }
  }

  async fetchFolderVideos(folderId: string): Promise<Video[]> {
    try {
      const result: AxiosResponse<GoogleDriveListResponse> = await this.api.get("/files", {
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
      if (axios.isAxiosError(err) && isGoogleDriveApiError(err.response)) {
        if (err.response.data.error.errors[0].reason === "dailyLimitExceeded") {
          throw new OutOfQuotaException(this.serviceId);
        }
        else {
          log.error(`Failed to get google drive folder: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
        }
      }
      else if (err instanceof Error) {
        log.error(`Failed to get google drive folder: ${err.message} ${err.stack}`);
      }
      else {
        log.error(`Failed to get google drive folder`);
      }
      throw err;
    }
  }

  async resolveURL(link: string): Promise<Video[]> {
    const url = new URL(link);

    if (this.isFolderURL(url)) {
      const folderId = this.getFolderId(url);
      return this.fetchFolderVideos(folderId);
    }
    else {
      const videoId = this.getVideoIdFromURL(url);
      return [await this.fetchVideoInfo(videoId)];
    }
  }

  parseFile(file: GoogleDriveFile): Video {
    return {
      service: this.serviceId,
      id: file.id,
      title: file.name,
      thumbnail: file.thumbnailLink,
      length: Math.ceil(file.videoMediaMetadata.durationMillis / 1000),
      mime: file.mimeType,
    };
  }
}

module.exports = GoogleDriveAdapter;
