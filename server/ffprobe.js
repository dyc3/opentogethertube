const util = require('util');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const { getLogger } = require("./logger.js");
const child_process = require('child_process');

const log = getLogger("infoextract.ffprobe");
const FFPROBE_PATH = process.env.FFPROBE_PATH || ffprobeInstaller.path;
const exec = util.promisify(child_process.exec);

log.debug(`ffprobe installed at ${FFPROBE_PATH}`);

module.exports = {
	async getFileInfo(uri) {
		log.debug(`Grabbing file info from ${uri}`);
		if (uri.includes('"')) {
			// if, by some weird off chance, the uri SOMEHOW contains a quote, don't execute the command
			// because it'll break, and probably lead to an exploit.
			log.error("Failed to grab file info: uri contains unescaped double quote, which is a banned character");
			throw new Error("Unescaped double quote found in uri");
		}
		const { error, stdout } = await exec(`${FFPROBE_PATH} -v quiet -i "${uri}" -print_format json -show_streams -show_format`);
		if (error) {
			log.error(`Failed to probe file info: ${error}`);
			throw error;
		}
		return JSON.parse(stdout);
	},
};
