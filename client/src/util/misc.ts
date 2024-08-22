export function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
	return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[];
}

export function isOfficialSite(): boolean {
	return window.location.hostname.endsWith("opentogethertube.com");
}
