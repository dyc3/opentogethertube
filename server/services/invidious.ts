import axios from "axios";
import { getLogger } from "../logger";
import { ServiceAdapter } from "../serviceadapter";
import { conf } from "../ott-config";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video";
import { InvalidVideoIdException } from "../exceptions";
import storage from "../storage";

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
    headers: { "User-Agent": `OpenTogetherTube-InvidiousServiceAdapter @ ${conf.get("hostname")}` },
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
    log.info(
      `Invidious adapter enabled. Instances: ${this.allowedHosts.join(", ")}`
    );
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
  
  /**
   * Build proxied manifest URL via the instance (no file extension; .mpd/.m3u8 not required).
   * Using local=1 ensures the instance proxies YT and adds permissive CORS.
   */
  private manifestUrl(host: string, id: string, type: "hls" | "dash"): string {
    const u = new URL(`https://${host}/api/manifest/${type}/id/${encodeURIComponent(id)}`);
    u.searchParams.set("local", "1");
    // optional but explicit
    u.searchParams.set("source", "youtube");
    return u.toString();
  }

  async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
    if (!videoId.includes(":")) {
      throw new InvalidVideoIdException(this.serviceId, videoId);
    }
    const [host, id] = videoId.split(":");

    const baseUrl = `https://${host}/api/v1/videos/${encodeURIComponent(id)}`;

    let data: InvidiousApiVideo | undefined;
    try {
      const resLocal = await this.api.get<InvidiousApiVideo>(`${baseUrl}?local=1`, {
        headers: { Accept: "application/json" }
      });
      data = resLocal.data;
    } catch {
        const res = await this.api.get<InvidiousApiVideo>(baseUrl, {
        headers: { Accept: "application/json" }
      });
      data = res.data;
    }

    if (!data?.title) {
      throw new Error(`Invidious API returned empty/invalid response for ${host}:${id}`);
    }

    // Prefer DASH/HLS (higher quality) and fall back to progressive "direct"
    const video = await this.parseAsDirect(data, host, id);

    // Pre-fill cache for the emitted (direct) video to avoid a follow-up metadata fetch
    // by DirectVideoAdapter (which might fail on CORS/HEAD/mime detection).
    try {
      await storage.updateVideoInfo(video);
    } catch (e: any) {
      log.warn(`Failed to prefill cache for ${video.service}:${video.id}: ${e?.message ?? e}`);
    }

    return video;
  }
  
  /** Proxied Progressive (MP4/WebM) over Invidious – avoids CORS/signature churn */
  private proxiedProgressive(host: string, id: string, itag?: number) {
    const u = new URL(`https://${host}/latest_version`);
    u.searchParams.set("id", id);
    if (itag) u.searchParams.set("itag", String(itag));
    u.searchParams.set("local", "1");
    // optional but harmless
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

  private async parseAsDirect(inv: InvidiousApiVideo, host: string, id: string): Promise<Video> {
    const rawDesc = (inv.description ?? inv.shortDescription ?? "").toString().trim();
    const safeDesc = rawDesc.length ? rawDesc : inv.title;

    const base = {
      title: inv.title,
      description: safeDesc,
      length: typeof inv.lengthSeconds === "string" ? parseInt(inv.lengthSeconds, 10) : inv.lengthSeconds,
      thumbnail: this.pickBestThumbnail(inv.videoThumbnails),
    };
    
    // 1) Probe DASH & HLS and pick the manifest whose top variant has the higher bitrate.
    try {
      const [dashProbe, hlsProbe] = await Promise.all([
        this.probeManifest(host, id, "dash"),
        this.probeManifest(host, id, "hls"),
      ]);
      const pick =
        dashProbe && hlsProbe
          ? (dashProbe.topKbps >= hlsProbe.topKbps ? dashProbe : hlsProbe)
          : (dashProbe ?? hlsProbe);
      if (pick) {
        log.info("Picked streaming manifest", { kind: pick.kind, url: pick.url, topKbps: pick.topKbps, topRes: pick.topRes });
        // optional async detail log of the full manifest:
        void this.logManifestSummary(pick.url, pick.kind);
        if (pick.kind === "dash") {
          return {
            service: "dash",
            id: pick.url,
            ...base,
            dash_url: pick.url,
            mime: "application/dash+xml",
          };
        } else {
          return {
            service: "hls",
            id: pick.url,
            ...base,
            hls_url: pick.url,
            // Mimetype application/vnd.apple.mpegurl not supported by hls player so switching to x-mpegURL
            mime: "application/x-mpegURL",
          };
        }
      }
    } catch (e) {
      log.warn(`DASH/HLS probing failed for ${host}:${id}, will try progressive.`, { err: e instanceof Error ? e.message : e });
    }

    // 2) Progressive fallback (MP4/WebM with audio) – proxied through /latest_version
    // Helper to extract numeric quality from labels like "720p", "480p", etc.
    const q = (label?: string) => {
      const m = (label || "").match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const list = (inv.formatStreams || []).filter(f => !!f.url);
    if (list.length) {
      // Prefer MP4 progressive (best browser compatibility) in highest available quality.
      const mp4 = list.filter(
        f => f.container === "mp4" || (f.type || "").toLowerCase().includes("mp4")
      );
      // Sort by quality descending (e.g., 720 > 480 > 360)
      const byQualityDesc = (a: InvidiousFormat, b: InvidiousFormat) =>
        q(b.qualityLabel) - q(a.qualityLabel);

      const bestMp4 = mp4.sort(byQualityDesc)[0];
      const bestAny = list.sort(byQualityDesc)[0];
      const chosen = bestMp4 || bestAny; // fall back to best progressive of any container

      // Guess MIME as precisely as we can; fall back sanely.
      let mime =
        chosen.type?.split(";")[0]?.trim() ||
        (chosen.container === "webm" ? "video/webm"
                                     : chosen.container === "mp4" ? "video/mp4"
                                                                  : undefined);

      // Always proxy via the instance (avoids CORS/signature churn) and carry itag if known.
      const proxied = this.proxiedProgressive(host, id, chosen.itag);

      // If MIME couldn’t be inferred, default to MP4 (works best across players).
      if (!mime) {
        // Heuristic: many common progressive itags (22, 18, 59) are MP4.
        if (typeof chosen.itag === "number" && [22, 18, 59].includes(chosen.itag)) {
          mime = "video/mp4";
        } else {
          // Final fallback
          mime = "video/mp4";
        }
      }
      log.info("Chosen progressive stream via /latest_version", {
        host, id,
        itag: chosen.itag,
        label: chosen.qualityLabel,
        container: chosen.container,
        bitrate: chosen.bitrate,
        mime,
      });
      return { service: "direct", id: proxied, ...base, mime };
    }

    // Fallback: let the instance pick a default via /latest_version (proxied)
    const fallback = this.proxiedProgressive(host, id);
    log.warn("No progressive formatStreams found; falling back to proxied /latest_version", {
      host, id
    });
    return {
      service: "direct",
      id: fallback,
      ...base,
      // Sensible default to avoid a follow-up probe in the pipeline:
      mime: "video/mp4",
    };
  }

  /**
   * Fetch and log a compact summary of the manifest (top variants by bandwidth).
   * Fire-and-forget: call with `void this.logManifestSummary(...)`.
   * Can be deleted after Developing this feature through
   */
  private async logManifestSummary(manifestUrl: string, kind: "dash" | "hls"): Promise<void> {
    try {
      const resp = await this.api.get<string>(manifestUrl, {
        headers: {
          Accept:
            kind === "dash"
              ? "application/dash+xml,text/plain;q=0.9,*/*;q=0.8"
              : "application/vnd.apple.mpegurl,application/x-mpegURL,text/plain;q=0.9,*/*;q=0.8",
        },
        responseType: "text",
        transformResponse: [(r) => r], // keep raw text
      });
      const text = typeof resp.data === "string" ? resp.data : String(resp.data);

      if (kind === "dash") {
        // Parse <Representation ... bandwidth="..." width="..." height="..." codecs="...">
        const tags = text.match(/<Representation\b[^>]*>/g) ?? [];
        const reps: Array<{ bw: number; w?: number; h?: number; codecs?: string }> = [];
        for (const tag of tags) {
          const attrs = Object.fromEntries(
            Array.from(tag.matchAll(/(\w+)=["']([^"']+)["']/g)).map(m => [m[1], m[2]])
          ) as Record<string, string>;
          const bw = Number(attrs["bandwidth"]);
          if (!bw || Number.isNaN(bw)) continue;
          const w = attrs["width"]  ? Number(attrs["width"])  : undefined;
          const h = attrs["height"] ? Number(attrs["height"]) : undefined;
          const codecs = attrs["codecs"];
          reps.push({ bw, w: (w && !Number.isNaN(w)) ? w : undefined, h: (h && !Number.isNaN(h)) ? h : undefined, codecs });
        }
        reps.sort((a, b) => b.bw - a.bw);
        const top = reps.slice(0, 5).map(r => ({
          bandwidth_kbps: Math.round(r.bw / 1000),
          resolution: (r.w && r.h) ? `${r.w}x${r.h}` : undefined,
          codecs: r.codecs,
        }));
        log.info(
          `DASH manifest summary url=${manifestUrl} total=${reps.length} variants=${JSON.stringify(top)}`
        );
        if (reps.length === 0) {
          const ct = String((resp.headers as any)['content-type'] || '');
          log.warn(
            `DASH manifest parsed 0 variants (content-type=${ct}). First 300 chars: ${text.slice(0, 300)}`
          );
        }
      } else {
        // HLS master: #EXT-X-STREAM-INF lines
        const lines = text.split(/\r?\n/);
        const entries: Array<{ bw?: number; res?: string; codecs?: string }> = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("#EXT-X-STREAM-INF:")) {
            const bw = Number((line.match(/BANDWIDTH=(\d+)/) || [])[1]);
            const res = (line.match(/RESOLUTION=(\d+x\d+)/) || [])[1];
            const codecs = (line.match(/CODECS="([^"]+)"/) || [])[1];
            entries.push({ bw: Number.isNaN(bw) ? undefined : bw, res, codecs });
          }
        }
        entries.sort((a, b) => (b.bw || 0) - (a.bw || 0));
        const top = entries.slice(0, 5).map(e => ({
          bandwidth_kbps: e.bw ? Math.round(e.bw / 1000) : undefined,
          resolution: e.res,
          codecs: e.codecs,
        }));
        log.info(
          `HLS master playlist summary url=${manifestUrl} total=${entries.length} variants=${JSON.stringify(top)}`
        );
        if (entries.length === 0) {
          const ct = String((resp.headers as any)['content-type'] || '');
          log.warn(
            `HLS manifest parsed 0 variants (content-type=${ct}). First 300 chars: ${text.slice(0, 300)}`
          );
        }
      }
    } catch (e) {
      log.warn(
        `Failed to fetch/parse ${kind.toUpperCase()} manifest for logging url=${manifestUrl} err=${e instanceof Error ? e.message : e}`
      );
    }
  }

  /** Probe a manifest and return its top bitrate/resolution. 
   * Needs to be there after finishing feature to give frontend all infos about quality
  */
  private async probeManifest(
    host: string,
    id: string,
    kind: "dash" | "hls"
  ): Promise<{ kind: "dash" | "hls"; url: string; topKbps: number; topRes?: string } | null> {
    const url = this.manifestUrl(host, id, kind);
    try {
      const resp = await this.api.get<string>(url, {
        headers: {
          Accept:
            kind === "dash"
              ? "application/dash+xml,text/plain;q=0.9,*/*;q=0.8"
              : "application/vnd.apple.mpegurl,application/x-mpegURL,text/plain;q=0.9,*/*;q=0.8",
        },
        responseType: "text",
        transformResponse: [(r) => r],
      });
      const text = typeof resp.data === "string" ? resp.data : String(resp.data);
      if (kind === "dash") {
        const tags = text.match(/<Representation\b[^>]*>/g) ?? [];
        let topBw = 0;
        let topRes: string | undefined;
        for (const tag of tags) {
          const bw = Number((tag.match(/bandwidth="(\d+)"/) || [])[1]);
          if (!bw || Number.isNaN(bw)) continue;
          if (bw > topBw) {
            topBw = bw;
            const w = Number((tag.match(/width="(\d+)"/) || [])[1]);
            const h = Number((tag.match(/height="(\d+)"/) || [])[1]);
            topRes = (w && h && !Number.isNaN(w) && !Number.isNaN(h)) ? `${w}x${h}` : undefined;
          }
        }
        return { kind, url, topKbps: Math.round(topBw / 1000), topRes };
      } else {
        const lines = text.split(/\r?\n/);
        let topBw = 0;
        let topRes: string | undefined;
        for (const line of lines) {
          if (line.startsWith("#EXT-X-STREAM-INF:")) {
            const bw = Number((line.match(/BANDWIDTH=(\d+)/) || [])[1]);
            if (bw && !Number.isNaN(bw) && bw > topBw) {
              topBw = bw;
              topRes = (line.match(/RESOLUTION=(\d+x\d+)/) || [])[1];
            }
          }
        }
        return { kind, url, topKbps: Math.round(topBw / 1000), topRes };
      }
    } catch (e) {
      log.warn(`probeManifest failed`, { kind, url, error: e instanceof Error ? e.message : e });
      return null;
    }
  }
}