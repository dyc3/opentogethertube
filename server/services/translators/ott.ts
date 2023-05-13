import { Result, ok, err } from "../../../common/result";
import { VideoId } from "../../../common/models/video";
import { ServiceTranslator } from "../../servicetranslator";

export class OttTranslator extends ServiceTranslator {
	canHandleURL(url: URL): boolean {
		return url.protocol === "ott:";
	}

	isCollectionURL(url: URL): boolean {
		return false;
	}

	resolveVideoId(url: URL): Result<VideoId, Error> {
		const parts = url.toString().slice(6).split("/");
		if (parts.length < 3) {
			return err(new Error("Invalid ott URL"));
		}
		if (parts[0] !== "video") {
			return err(new Error("Invalid ott URL"));
		}
		const [service, id] = parts.slice(1);
		return ok({ service, id });
	}
}
