import loadScript from "load-script";

/**
 * A collection of helper functions to make adding support for new services easier.
 */

/**
 * Gets a library intended to be embedded normally when in vanilla JS, and makes it so that we can use it inside Vue.
 *
 * Inspired by https://github.com/CookPete/react-player/blob/9be7a9c9d24d08801b1f31f93bdfabf45ea1bf83/src/utils.js#L64
 *
 * @param {String} url The url to the JS SDK.
 * @param {*} sdkGlobal
 */
export function getSdk(url, sdkGlobal) {
	return new Promise((resolve, reject) => {
		loadScript(url, err => {
			if (err) {
				reject(err);
			}
			else {
				resolve(window[sdkGlobal]);
			}
		});
	});
}
