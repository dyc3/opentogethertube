import { Result } from "../common/result";
import { VideoId } from "../common/models/video";

/**
 * Similar to ServiceAdapter, except purely dedicated to turning URLs for one service into `VideoId`s that a ServiceAdapter can use.
 * Eventually, all ServiceAdapters should move all URL parsing to ServiceTranslators.
 */
export abstract class ServiceTranslator {
	abstract canHandleURL(url: URL): boolean;
	abstract isCollectionURL(url: URL): boolean;
	abstract resolveVideoId(url: URL): Result<VideoId, Error>;
}
