import { URL } from "url";
import axios from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { InvalidVideoIdException } from "../exceptions";
import { Video, VideoDefault } from "../../common/models/video";

export default class DailyMotionAdapter extends ServiceAdapter {
  api = axios.create({
    baseURL: "https://api.dailymotion.com",
  });

  get serviceId(): "dailymotion" {
    return "dailymotion";
  }

  canHandleURL(link: string): boolean {
    const url = new URL(link);

    return (
      (url.host.endsWith("dailymotion.com") && url.pathname.startsWith("/video/")) ||
      (url.host.endsWith("dai.ly") && url.pathname.length > 1)
    );
  }

  isCollectionURL(): boolean {
    return false;
  }

  getVideoId(link: string): string {
    const url = new URL(link);
    return url.pathname.split("/").slice(-1)[0].trim();
  }

  async fetchVideoInfo(videoId: string): Promise<Video> {
    if (!/^[A-za-z0-9]+$/.exec(videoId)) {
      throw new InvalidVideoIdException(this.serviceId, videoId);
    }

    const result = await this.api.get(`/video/${videoId}`, {
      params: {
        fields: "title,description,thumbnail_url,duration",
      },
    });

    const video: VideoDefault = {
      service: this.serviceId,
      id: videoId,
      title: result.data.title,
      description: result.data.description,
      thumbnail: result.data.thumbnail_url,
      length: result.data.duration,
    };

    return video;
  }
}

module.exports = DailyMotionAdapter;
