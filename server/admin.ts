import { OttException } from "../common/exceptions";
import { conf } from "./ott-config";

/**
 * @deprecated use `conf.get("api_key")` instead
 * @returns the api key
 */
export function getApiKey() {
	return conf.get("api_key");
}

/**
 * @deprecated use `conf.set("api_key", key)` instead
 */
export function setApiKey(key: string) {
	conf.set("api_key", key);
}

export function requireApiKey(input: string) {
	let apikey = conf.get("api_key");
	if (!apikey) {
		throw new OttException("apikey is not set");
	}
	if (input !== apikey) {
		throw new OttException("apikey is invalid");
	}
}
