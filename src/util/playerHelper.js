import loadScript from "load-script";

/**
 * A collection of helper functions to make adding support for new services easier.
 */

const requests = {};
/**
 * Gets a library intended to be embedded normally when in vanilla JS, and makes it so that we can use it inside Vue.
 *
 * Shamelessly copied from https://github.com/CookPete/react-player/blob/9be7a9c9d24d08801b1f31f93bdfabf45ea1bf83/src/utils.js#L64
 *
 * @param {String} url The url to the JS SDK.
 * @param {*} sdkGlobal
 * @param {String} sdkReady Name of the function that is automatically called when the api is ready to be used.
 */
export function getSdk(url, sdkGlobal, sdkReady=null, isLoaded=() => true, fetchScript=loadScript) {
	if (window[sdkGlobal] && isLoaded(window[sdkGlobal])) {
		return Promise.resolve(window[sdkGlobal]);
	}
	return new Promise((resolve, reject) => {
		// If we are already loading the SDK, add the resolve and reject
		// functions to the existing array of requests
		if (requests[url]) {
			requests[url].push({ resolve, reject });
			return;
		}
		requests[url] = [{ resolve, reject }];
		const onLoaded = sdk => {
			// When loaded, resolve all pending request promises
			requests[url].forEach(request => request.resolve(sdk));
		};
		if (sdkReady) {
			const previousOnReady = window[sdkReady];
			window[sdkReady] = () => {
				if (previousOnReady) {
					previousOnReady();
				}
				onLoaded(window[sdkGlobal]);
			};
		}
		fetchScript(url, err => {
			if (err) {
				// Loading the SDK failed – reject all requests and
				// reset the array of requests for this SDK
				requests[url].forEach(request => request.reject(err));
				requests[url] = null;
			}
			else if (!sdkReady) {
				onLoaded(window[sdkGlobal]);
			}
		});
	});
}
