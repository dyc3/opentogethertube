import util from "util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { getLogger } from "./logger";
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
import { conf } from "./ott-config";

const log = getLogger("infoextract/ffprobe");
const exec = util.promisify(child_process.exec);

function streamDataIntoFfprobe(
	ffprobePath: string,
	stream: Stream,
	controller: AbortController
): Promise<string> {
	return new Promise((resolve, reject) => {
		let stream_ended = true;

		let child = child_process.spawn(
			`${ffprobePath}`,
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
			stream.emit("end");
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

export abstract class FfprobeStrategy {
	ffprobePath: string;

	constructor() {
		this.ffprobePath = conf.get("info_extractor.direct.ffprobe_path") || ffprobeInstaller.path;
		log.debug(`ffprobe installed at ${this.ffprobePath}`);
	}

	abstract getFileInfo(uri: string): Promise<any>;
}

export class RunFfprobe extends FfprobeStrategy {
	async getFileInfo(uri: string): Promise<any> {
		log.debug(`Grabbing file info from ${uri}`);
		if (uri.includes('"')) {
			// if, by some weird off chance, the uri SOMEHOW contains a quote, don't execute the command
			// because it'll break, and probably lead to an exploit.
			log.error(
				"Failed to grab file info: uri contains unescaped double quote, which is a banned character"
			);
			throw new Error("Unescaped double quote found in uri");
		}
		const { stdout } = await exec(
			`${this.ffprobePath} -v quiet -i "${uri}" -print_format json -show_streams -show_format`
		);
		return JSON.parse(stdout);
	}
}

export class OnDiskPreviewFfprobe extends FfprobeStrategy {
	async getFileInfo(uri: string): Promise<any> {
		log.debug(`Grabbing file info from ${uri}`);

		let tmpdir = await fs.mkdtemp("/tmp/ott");
		let tmpfile = path.join(tmpdir, "./preview");
		log.debug(`saving preview to ${tmpfile}`);
		let handle = await fs.open(tmpfile, "w");

		const httpAgent = new http.Agent({ keepAlive: false });
		const httpsAgent = new https.Agent({ keepAlive: false });
		const controller = new AbortController();
		let resp = await axios.get<Stream>(uri, {
			responseType: "stream",
			signal: controller.signal,
			httpAgent,
			httpsAgent,
		});

		const byte_limit = conf.get("info_extractor.direct.preview_max_bytes") ?? Infinity;

		try {
			let counter = 0;
			resp.data.on("data", data => {
				log.silly("got data");

				counter += data.length;
				counterBytesDownloaded.inc(data.length);
				if (counter > byte_limit) {
					log.debug(`read ${counter} bytes, stopping`);
					controller.abort();
				}
			});

			await resp.data.pipe(handle.createWriteStream());
		} finally {
			controller.abort();
			httpAgent.destroy();
			httpsAgent.destroy();
		}

		try {
			const { stdout } = await exec(
				`${this.ffprobePath} -v quiet -i "${tmpfile}" -print_format json -show_streams -show_format`
			);
			return JSON.parse(stdout);
		} finally {
			await fs.rm(tmpfile);
		}
	}
}

export class StreamFfprobe extends FfprobeStrategy {
	async getFileInfo(uri: string): Promise<any> {
		log.debug(`Grabbing file info from ${uri}`);

		const httpAgent = new http.Agent({ keepAlive: false });
		const httpsAgent = new https.Agent({ keepAlive: false });
		const controller = new AbortController();
		let resp = await axios.get<Stream>(uri, {
			responseType: "stream",
			signal: controller.signal,
			httpAgent,
			httpsAgent,
		});
		try {
			let stdout = await streamDataIntoFfprobe(this.ffprobePath, resp.data, controller);
			return JSON.parse(stdout);
		} finally {
			controller.abort();
			httpAgent.destroy();
			httpsAgent.destroy();
		}
	}
}

const counterBytesDownloaded = new Counter({
	name: "ott_infoextractor_direct_bytes_downloaded",
	help: "The number of bytes that have been downloaded for the purpose of getting direct video metadata",
});
