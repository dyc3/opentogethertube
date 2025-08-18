import axios, { type AxiosResponse } from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter } from "../serviceadapter";
import { conf } from "../ott-config";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video";
import { InvalidVideoIdException } from "../exceptions";

const log = getLogger("invidious");

interface InvidiousFormat {
  itag?: number;
  url: string;
  type?: string;        // e.g. "video/mp4; codecs=..."
  container?: string;   // e.g. "mp4"
  qualityLabel?: string;// e.g. "1080p"
  bitrate?: number;
  audioQuality?: string;
}

interface InvidiousApiVideo {
  title: string;
  author?: string;
  description?: string;
  shortDescription?: string;
  //lengthSeconds: number;
  lengthSeconds: number | string;
  // Some instances expose one or both fields below:
  hlsUrl?: string;
  dashUrl?: string;
  formatStreams?: InvidiousFormat[];     // progressive (with audio)
  adaptiveFormats?: InvidiousFormat[];   // may include .m3u8/.mpd
  videoThumbnails?: { url: string; width?: number; height?: number }[];
}

export default class InvidiousAdapter extends ServiceAdapter {
  api = axios.create({
    headers: { "User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}` },
  });

  allowedHosts: string[] = [];

  get serviceId(): VideoService {
    return "invidious";
  }

  get isCacheSafe(): boolean {
    return true;
  }

  async initialize(): Promise<void> {
    this.allowedHosts = conf.get("info_extractor.invidious.instances");
  }

  canHandleURL(link: string): boolean {
    const url = new URL(link);
    if (!this.allowedHosts.includes(url.host)) return false;

    // /watch?v=VIDEOID  OR  /w/VIDEOID
    if (url.pathname === "/watch") {
      return url.searchParams.has("v");
    }
    return /^\/w\/[A-Za-z0-9_-]{11}$/.test(url.pathname);
  }

  isCollectionURL(_link: string): boolean {
    // Playlists/Channels – not supported
    return false;
  }

  getVideoId(link: string): string {
    const url = new URL(link);
    let id: string | null = null;

    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else if (/^\/w\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) {
      id = url.pathname.split("/").pop() || null;
    }

    if (!id) {
      throw new InvalidVideoIdException(this.serviceId, link);
    }
    return `${url.host}:${id.trim()}`;
  }
  
  async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
    if (!videoId.includes(":")) {
      throw new InvalidVideoIdException(this.serviceId, videoId);
    }
    const [host, id] = videoId.split(":");

    const useLocal: boolean = !!conf.get("info_extractor.invidious.local");
    const baseUrl = `https://${host}/api/v1/videos/${encodeURIComponent(id)}`;

    let data: InvidiousApiVideo | undefined;
    try {
      const resLocal = await this.api.get<InvidiousApiVideo>(useLocal ? `${baseUrl}?local=1` : baseUrl, {
        headers: { Accept: "application/json" }
      });
      data = resLocal.data;
    } catch {
        const resLocal = await this.api.get<InvidiousApiVideo>(useLocal ? `${baseUrl}` : baseUrl, {
        headers: { Accept: "application/json" }
      });
      data = resLocal.data;
    }

    if (!data?.title) {
      const res = await this.api.get<InvidiousApiVideo>(baseUrl, { headers: { Accept: "application/json" } });
      data = res.data;
    }

    if (!data?.title) {
      throw new Error(`Invidious API returned empty/invalid response for ${host}:${id}`);
    }

    if (conf.get("info_extractor.invidious.emit_as_direct")) {
      return this.parseAsDirect(data, host, id);
    } else {
      return this.parseVideoAsInvidious(data, host, id);
    }
  }
  
  private withLocal(url?: string): string | undefined {
  if (!url) return url;
  const useLocal = !!conf.get("info_extractor.invidious.local");
  if (!useLocal) return url;
  return /[?&]local=1\b/.test(url) ? url : url + (url.includes("?") ? "&" : "?") + "local=1";
  }

  private manifestUrl(host: string, id: string, type: "hls" | "dash") {
    const base = `https://${host}/api/manifest/${type}/id/${encodeURIComponent(id)}`;
    return this.withLocal(base);
  }

  // Proxied Progressive (MP4/WebM) over Invidious – avoiding CORS issues
  private proxiedProgressive(host: string, id: string, itag?: number) {
    const u = new URL(`https://${host}/latest_version`);
    u.searchParams.set("id", id);
    if (itag) u.searchParams.set("itag", String(itag));
    u.searchParams.set("local", "1");
    // "source=youtube" ist optional
    u.searchParams.set("source", "youtube");
    return u.toString();
  }

  private pickBestThumbnail(thumbnails?: { url: string; width?: number; height?: number }[]): string | undefined {
    if (!thumbnails || thumbnails.length === 0) return undefined;
    const sorted = [...thumbnails].sort((a, b) => {
      const aPixels = (a.width || 0) * (a.height || 0);
      const bPixels = (b.width || 0) * (b.height || 0);
      return bPixels - aPixels;
    });
    return sorted[0]?.url;
  }
  
  private parseVideoAsInvidious(inv: InvidiousApiVideo, host: string, id: string): Video {
    const len = typeof inv.lengthSeconds === "string" ? parseInt(inv.lengthSeconds, 10) : inv.lengthSeconds;
    const rawDesc = (inv.description ?? inv.shortDescription ?? "").toString().trim();
    const safeDesc = rawDesc.length ? rawDesc : inv.title;

    const video: Video = {
      service: this.serviceId,
      id: `${host}:${id}`,
      title: inv.title,
      description: safeDesc,
      length: Number.isFinite(len) ? (len as number) : undefined,
      thumbnail: this.pickBestThumbnail(inv.videoThumbnails),
    };

    return video;
  }

  private parseAsDirect(inv: InvidiousApiVideo, host: string, id: string): Video {
    const rawDesc = (inv.description ?? inv.shortDescription ?? "").toString().trim();
    const safeDesc = rawDesc.length ? rawDesc : inv.title;

    const base = {
      title: inv.title,
      description: safeDesc,
      length: typeof inv.lengthSeconds === "string" ? parseInt(inv.lengthSeconds, 10) : inv.lengthSeconds,
      thumbnail: this.pickBestThumbnail(inv.videoThumbnails),
    };
    
    const useLocal = !!conf.get("info_extractor.invidious.local");
    const preferProgressive = !!conf.get("info_extractor.invidious.prefer_progressive");
    
    // 0) If local=true:
    //    0a) if prefer_progressive=true -> serve proxied MP4/WebM via /latest_version
    //    0b) otherwise -> serve proxied manifest (prefer DASH if available)
    if (useLocal) {
    // 0a) proxied MP4/WebM
    if (useLocal && preferProgressive) {
      const list = inv.formatStreams || [];
      const progressive =
        list.find(f => f.qualityLabel === "1080p" && f.url) ||
        list.find(f => f.url && ((f.container === "mp4") || (f.type || "").includes("mp4"))) ||
        list[0];
      if (progressive) {
        const url = this.proxiedProgressive(host, id, progressive.itag);
        const mime =
          progressive.type?.split(";")[0]?.trim() ||
          (progressive.container === "webm" ? "video/webm" : "video/mp4");
        return { service: "direct", id: url, ...base, mime };
      }
    }
    // 0b) proxied manifest (prefer DASH when possible)
    if (useLocal) {
      const preferDash =
        !!(inv as any).dashUrl ||
        (inv.adaptiveFormats || []).some(f => f.url?.includes(".mpd"));
      const forced = this.manifestUrl(host, id, preferDash ? "dash" : "hls")!;
      return preferDash
        ? { service: "dash", id: forced, ...base, dash_url: forced }
        : { service: "hls",  id: forced, ...base, hls_url:  forced };
    }
  }
    // 1) HLS from API (with ?local=1)
    if (inv.hlsUrl) {
      const hls = this.withLocal(inv.hlsUrl);
      return {
        service: "hls",
        id: hls!,
        ...base,
        hls_url: hls!,
      };
    }
    // 2) DASH (dashUrl) with ?local=1
    if ((inv as any).dashUrl) {
      const dash = this.withLocal((inv as any).dashUrl as string)!;
      return {
        service: "dash",
        id: dash,
        ...base,
        dash_url: dash,
      };
    }
  const adaptive = (inv.adaptiveFormats || []).find(
    f => f.url && (f.url.includes(".m3u8") || f.url.includes(".mpd"))
  );

    if (adaptive) {
      if (adaptive.url.includes(".m3u8")) {
        const h = useLocal ? this.manifestUrl(host, id, "hls")! : this.withLocal(adaptive.url)!;
        return { service: "hls", id: h, ...base, hls_url: h };
      } else if (adaptive.url.includes(".mpd")) {
        const d = useLocal ? this.manifestUrl(host, id, "dash")! : this.withLocal(adaptive.url)!;
        return { service: "dash", id: d, ...base, dash_url: d };
      }
    }

    const progressiveList = inv.formatStreams || [];
    const progressive =
      progressiveList.find(f => f.qualityLabel === "1080p" && f.url) ||
      progressiveList.find(f => f.url && ((f.container === "mp4") || (f.type || "").includes("mp4"))) ||
      progressiveList[0];

    if (progressive?.url) {
      const mime =
        progressive.type?.split(";")[0]?.trim() ||
        (progressive.container === "webm" ? "video/webm" : "video/mp4");
      const video: Video = {
        service: "direct",
        id: (useLocal && preferProgressive)
              ? this.proxiedProgressive(host, id, progressive.itag)
              : progressive.url,
        ...base,
        mime
      };
      return video;
    }
    const any =
      (inv.formatStreams || []).concat(inv.adaptiveFormats || []).find(f => !!f.url)?.url;

    if (any) {
      const video: Video = {
        service: "direct",
        id: (useLocal && preferProgressive) ? this.proxiedProgressive(host, id) : any,
        ...base,
        mime: any.includes(".webm") ? "video/webm" : "video/mp4"
      };
      return video;
    }
    throw new Error("Unable to extract video URL from Invidious video");
  }
}