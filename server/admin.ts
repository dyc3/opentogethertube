import { OttException } from "../common/exceptions";
import { conf } from "./ott-config";

let apikey = conf.get("api_key");

export function getApiKey() {
	return apikey;
}

export function setApiKey(key: string) {
	apikey = key;
}

export function requireApiKey(input: string) {
	if (!apikey) {
		throw new OttException("apikey is not set");
	}
	if (input !== apikey) {
		throw new OttException("apikey is invalid");
	}
}
