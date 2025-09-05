import axios from "axios";
import maxBy from "lodash/maxBy.js";
import { getLogger } from "../logger.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { InvalidVideoIdException } from "../exceptions.js";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { conf } from "../ott-config.js";
import storage from "../storage.js";

const log = getLogger("odysee");

export default class OdyseeAdapter extends ServiceAdapter {
	get serviceId(): VideoService {
		return "odysee";
	}

    get isCacheSafe(): boolean {
		return true;
	}

    async initialize(): Promise<void> {
        // Do nothing
    }

	canHandleURL(url: string): boolean {
		return false;
	}

	isCollectionURL(url: string): boolean {
		return false;
	}

	getVideoId(url: string): string {
		return "";
	}

	async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		return [];
	}
}
