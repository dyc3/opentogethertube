import { OttException } from "../common/exceptions";

let apikey = process.env.OPENTOGETHERTUBE_API_KEY;

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
