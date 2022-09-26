import util from "util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { getLogger } from "./logger.js";
import child_process from "child_process";
import axios from "axios";
import { Stream } from "stream";
import fs from "fs/promises";
import path from "path";
// FIXME: remove node-abort-controller package when we stop supporting node 14.
import { AbortController } from "node-abort-controller";
import http from "http";
import https from "https";

const log = getLogger("infoextract.ffprobe");
const FFPROBE_PATH: string = process.env.FFPROBE_PATH || ffprobeInstaller.path;
const DIRECT_PREVIEW_MAX_BYTES = (() => {
	if (process.env.DIRECT_PREVIEW_MAX_BYTES) {
		return parseInt(process.env.DIRECT_PREVIEW_MAX_BYTES);
	}
	return Infinity;
})();
const exec = util.promisify(child_process.exec);

log.debug(`ffprobe installed at ${FFPROBE_PATH}`);

export async function getFileInfo(uri: string) {
	log.debug(`Grabbing file info from ${uri}`);
	if (uri.includes('"')) {
		// if, by some weird off chance, the uri SOMEHOW contains a quote, don't execute the command
		// because it'll break, and probably lead to an exploit.
		log.error(
			"Failed to grab file info: uri contains unescaped double quote, which is a banned character"
		);
		throw new Error("Unescaped double quote found in uri");
	}
	const httpAgent = new http.Agent({ keepAlive: false });
	const httpsAgent = new https.Agent({ keepAlive: false });
	const controller = new AbortController();
	let resp = await axios.get(uri, {
		responseType: "stream",
		// @ts-expect-error
		signal: controller.signal,
		httpAgent,
		httpsAgent,
	});

	log.debug("Got response, beginning pipe");
	let tmpfile: string;
	try {
		tmpfile = await saveVideoPreview(resp.data);
	} finally {
		controller.abort();
		httpAgent.destroy();
		httpsAgent.destroy();
	}

	// let stdout = await streamDataIntoFfprobe(resp.data);

	try {
		const { stdout } = await exec(
			`${FFPROBE_PATH} -v quiet -i "${tmpfile}" -print_format json -show_streams -show_format`
		);
		return JSON.parse(stdout);
	} finally {
		await fs.rm(tmpfile);
	}
}

async function saveVideoPreview(stream: Stream): Promise<string> {
	let tmpdir = await fs.mkdtemp("/tmp/ott");
	let tmpfile = path.join(tmpdir, "./preview");
	log.debug(`saving preview to ${tmpfile}`);
	let handle = await fs.open(tmpfile, "w");

	let counter = 0;
	return new Promise((resolve, reject) => {
		function finish() {
			stream.removeAllListeners();
			handle.close();
			resolve(tmpfile);
		}
		stream.on("data", async data => {
			await handle.write(data);
			counter += data.length;
			if (counter > DIRECT_PREVIEW_MAX_BYTES) {
				finish();
			}
		});
		stream.on("end", () => {
			finish();
		});
	});
}

function streamDataIntoFfprobe(stream: Stream): Promise<string> {
	// this doesn't work because node is dumb
	// but obviously it would be the prefered method.
	// so im leaving it in in case somebody can get it to work.
	return new Promise((resolve, reject) => {
		let stream_ended = true;

		let child = child_process.spawn(
			// `${FFPROBE_PATH} -v quiet -print_format json -show_streams -show_format -`
			`${FFPROBE_PATH} -v trace -print_format json -show_streams -show_format -`,
			{
				// stdio: "pipe",
				shell: true,
			}
		);
		// stream.pipe(child.stdin);
		log.debug("ffprobe child spawned");
		let result_json = "";
		function finalize() {
			let stdout = child.stdout.read();
			log.debug(`ffprobe finalized stdout: ${stdout}`);
			resolve(result_json);
		}

		stream.on("data", data => {
			if (child.exitCode !== null) {
				log.debug(`ffprobe exited: ${child.exitCode}`);
				finalize();
				return;
			}

			log.debug(`got data, writing`);
			try {
				if (!child.stdin.destroyed) {
					child.stdin.cork();
					child.stdin.write(data);
					child.stdin.uncork();
				} else {
					log.debug(`ffprobe stdin destroyed`);
				}
			} catch (e) {
				log.debug(`write failed: ${e}`);
			}
		});
		stream.on("end", () => {
			log.debug("http stream ended");
			stream_ended = true;
			child.stdin.end();
			log.debug(`readable ${child.stdout.readable} ${child.stdout.readableLength}`);
			let r = child.stdout.read(child.stdout.readableLength);
			log.debug(`i read ${r}`);
		});
		stream.on("error", error => {
			log.error(`http stream error: ${error}`);
			reject(error);
		});
		child.stdout.on("data", data => {
			log.debug(`ffprobe output: ${data}`);
			result_json += data;
		});
		child.stdout.on("end", () => {
			log.debug("ffprobe is done writing output");
			finalize();
		});
	});
}

export default {
	getFileInfo,
};
