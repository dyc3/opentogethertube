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
import { Counter } from "prom-client";

const log = getLogger("infoextract.ffprobe");
const FFPROBE_PATH: string = process.env.FFPROBE_PATH || ffprobeInstaller.path;
const DIRECT_PREVIEW_MAX_BYTES = (() => {
	if (process.env.DIRECT_PREVIEW_MAX_BYTES) {
		return parseInt(process.env.DIRECT_PREVIEW_MAX_BYTES);
	}
	return Infinity;
})();
enum FetchMode {
	PreviewOnDisk,
	StreamToStdin,
}
const FETCH_MODE = FetchMode.StreamToStdin;
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
		signal: controller.signal,
		httpAgent,
		httpsAgent,
	});

	log.debug(`Got response: ${resp.status}`);
	// @ts-expect-error
	if (FETCH_MODE === FetchMode.PreviewOnDisk) {
		let tmpfile: string;
		try {
			tmpfile = await saveVideoPreview(resp.data);
		} finally {
			controller.abort();
			httpAgent.destroy();
			httpsAgent.destroy();
		}
		try {
			const { stdout } = await exec(
				`${FFPROBE_PATH} -v quiet -i "${tmpfile}" -print_format json -show_streams -show_format`
			);
			return JSON.parse(stdout);
		} finally {
			await fs.rm(tmpfile);
		}
	} else if (FETCH_MODE === FetchMode.StreamToStdin) {
		try {
			let stdout = await streamDataIntoFfprobe(resp.data, controller);
			return JSON.parse(stdout);
		} finally {
			controller.abort();
			httpAgent.destroy();
			httpsAgent.destroy();
		}
	} else {
		throw new Error("Unknown fetch mode");
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
			counterBytesDownloaded.inc(data.length);
			if (counter > DIRECT_PREVIEW_MAX_BYTES) {
				finish();
			}
		});
		stream.on("end", () => {
			finish();
		});
		stream.on("error", error => {
			log.error(`http stream error: ${error}`);
			stream.removeAllListeners();
			handle.close();
			reject(error);
		});
	});
}

function streamDataIntoFfprobe(stream: Stream, controller: AbortController): Promise<string> {
	return new Promise((resolve, reject) => {
		let stream_ended = true;

		let child = child_process.spawn(
			`${FFPROBE_PATH}`,
			["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", "-"],
			{
				stdio: "pipe",
				windowsHide: true,
			}
		);
		log.debug(`ffprobe child spawned: ${child.pid}`);
		let result_json = "";
		function finalize() {
			stream.removeAllListeners();
			try {
				controller.abort();
			} catch (e) {
				if (!axios.isCancel(e)) {
					log.error(`Failed to abort request: ${e}`);
				}
			}
			resolve(result_json);
		}

		stream.on("data", data => {
			counterBytesDownloaded.inc(data.length);
			if (child.stdin.destroyed) {
				return;
			}
			child.stdin.write(data, e => {
				if (e) {
					log.debug(`write failed (destroyed: ${child.stdin.destroyed}): ${e}`);
				}
			});
		});
		child.stdin.on("error", e => {
			log.debug(`ffprobe stdin error: ${e}`);
		});
		stream.on("end", () => {
			log.debug("http stream ended");
			stream_ended = true;
			if (child.stdin.destroyed) {
				return;
			}
			child.stdin.end();
		});
		stream.on("error", error => {
			log.error(`http stream error: ${error}`);
			reject(error);
		});
		child.stdout.on("data", data => {
			log.debug(`ffprobe output: ${data}`);
			result_json += data;
		});
		child.stderr.on("data", data => {
			log.silly(`${data}`);
		});
		child.on("close", () => {
			log.debug("ffprobe closed");
			finalize();
		});
	});
}

export default {
	getFileInfo,
};

const counterBytesDownloaded = new Counter({
	name: "ott_infoextractor_direct_bytes_downloaded",
	help: "The number of bytes that have been downloaded for the purpose of getting direct video metadata",
});
