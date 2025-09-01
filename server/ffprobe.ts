import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { getLogger } from "./logger.js";
import childProcess from "child_process";
import axios from "axios";
import { Stream } from "stream";
import fs from "fs/promises";
import path from "path";
// FIXME: remove node-abort-controller package when we stop supporting node 14.
import { AbortController } from "node-abort-controller";
import http from "http";
import https from "https";
import { Counter } from "prom-client";
import { conf } from "./ott-config.js";

const log = getLogger("infoextract/ffprobe");

// Note: we avoid using exec for ffprobe to prevent shell injection.
// Hard, non-configurable timeout for every ffprobe run (in ms).
// Timeout in ms 45000 = 45 secs more then enough Time as descriped in #1056 (30s)
const FFPROBE_TIMEOUT_MS = 45000;

function streamDataIntoFfprobe(
	ffprobePath: string,
	stream: Stream,
	controller: AbortController
): Promise<string> {
	return new Promise((resolve, reject) => {
		// Spawn ffprobe and feed data via stdin (no shell).
		const args = ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", "-"];
		const child = childProcess.spawn(ffprobePath, args, {
			stdio: "pipe",
			windowsHide: true,
		});

		log.debug(`ffprobe child spawned: ${child.pid}`);
		let resultJson = "";
		let errBuf = ""; // collect stderr for better error messages

		// Kill ffprobe if it runs too long.
		const killer = setTimeout(() => {
			log.warn(`ffprobe pid=${child.pid} timed out after ${FFPROBE_TIMEOUT_MS}ms — killing`);
			try {
				child.kill("SIGKILL");
			} catch (e) {
				log.debug(`ffprobe process: kill-error @48: ${String(e)}`);
			}
			try {
				controller.abort();
			} catch (e) {
				log.debug(`ffprobe process: controller-error @53: ${String(e)}`);
			}
		}, FFPROBE_TIMEOUT_MS);

		stream.on("data", data => {
			counterBytesDownloaded.inc(data.length);
			// If ffprobe closed stdin, stop downloading further data.
			if (child.stdin.destroyed) {
				try {
					controller.abort();
				} catch (e) {
					log.debug(`ffprobe process: controller-error @64: ${String(e)}`);
				}
				return;
			}
			child.stdin.write(data, e => {
				if (e) {
					log.debug(`write failed (destroyed: ${child.stdin.destroyed}): ${String(e)}`);
					try {
						controller.abort();
					} catch (e) {
						log.debug(`ffprobe process: controller-error @74: ${String(e)}`);
					}
				}
			});
		});
		child.stdin.on("error", e => {
			log.debug(`ffprobe stdin error: ${String(e)}`);
		});
		stream.on("end", () => {
			log.debug("http stream ended");
			if (!child.stdin.destroyed) {
				child.stdin.end();
			}
		});
		stream.on("error", error => {
			log.error(`http stream error: ${String(error)}`);
			try {
				controller.abort();
			} catch (e) {
				log.debug(`ffprobe process: controller-error @93: ${String(e)}`);
			}
			reject(error);
		});
		child.stdout.on("data", data => {
			log.debug(`ffprobe output: ${data}`);
			resultJson += data;
		});
		child.stderr.on("data", data => {
			log.silly(`${data}`);
			errBuf += String(data);
		});
		child.on("error", err => {
			clearTimeout(killer);
			log.error(`ffprobe process error: ${String(err)}`);
			try {
				controller.abort();
			} catch (e) {
				log.debug(`ffprobe process: controller-error @111: ${String(e)}`);
			}
			reject(err);
		});
		child.on("close", (code, signal) => {
			clearTimeout(killer);
			log.debug(`ffprobe closed (code=${code}, signal=${signal ?? "none"})`);
			stream.removeAllListeners();
			try {
				controller.abort();
			} catch (e) {
				log.debug(`ffprobe process: controller-error @122: ${String(e)}`);
			}
			if (code === 0) {
				return resolve(resultJson);
			}
			reject(
				new Error(
					`ffprobe exited non-zero (code=${code}, signal=${
						signal ?? "none"
					}) stderr=${errBuf}`
				)
			);
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
		// Use spawn with args (no shell). This prevents shell injection issues.
		const args = [
			"-v",
			"quiet",
			"-i",
			uri,
			"-print_format",
			"json",
			"-show_streams",
			"-show_format",
		];
		const child = childProcess.spawn(this.ffprobePath, args, {
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let out = "";
		let err = "";

		const killer = setTimeout(() => {
			log.warn(`ffprobe (RunFfprobe) timed out after ${FFPROBE_TIMEOUT_MS}ms — killing`);
			try {
				child.kill("SIGKILL");
			} catch (e) {
				log.debug(`ffprobe process: kill-error @175: ${String(e)}`);
			}
		}, FFPROBE_TIMEOUT_MS);

		child.stdout.on("data", d => {
			out += d;
		});

		child.stderr.on("data", d => {
			err += d;
		});

		await new Promise<void>((resolve, reject) => {
			child.on("error", reject);
			child.on("close", (code, signal) => {
				clearTimeout(killer);
				if (code === 0) {
					return resolve();
				}
				reject(
					new Error(`ffprobe exit code ${code} signal ${signal ?? "none"} stderr=${err}`)
				);
			});
		});
		return JSON.parse(out);
	}
}

export class OnDiskPreviewFfprobe extends FfprobeStrategy {
	async getFileInfo(uri: string): Promise<any> {
		log.debug(`Grabbing file info from ${uri}`);

		// Create a unique temp dir and clean it later.
		const tmpdir = await fs.mkdtemp("/tmp/ott-");
		const tmpfile = path.join(tmpdir, "preview");
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

		const byteLimit = conf.get("info_extractor.direct.preview_max_bytes") ?? Infinity;

		try {
			let counter = 0;
			resp.data.on("data", data => {
				log.silly("got data");

				counter += data.length;
				counterBytesDownloaded.inc(data.length);
				if (counter > byteLimit) {
					log.debug(`read ${counter} bytes, stopping`);
					controller.abort();
				}
			});

			await resp.data.pipe(handle.createWriteStream());
		} finally {
			controller.abort();
			httpAgent.destroy();
			httpsAgent.destroy();
			await handle.close().catch(e => {
				log.debug(`ffprobe process: handle.close error @244: ${String(e)}`);
			});
		}

		try {
			// Run ffprobe on the local preview file with timeout and exit checks.
			const args = [
				"-v",
				"quiet",
				"-i",
				tmpfile,
				"-print_format",
				"json",
				"-show_streams",
				"-show_format",
			];
			const child = childProcess.spawn(this.ffprobePath, args, {
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
			});
			let out = "";
			let err = "";
			const killer = setTimeout(() => {
				log.warn(
					`ffprobe (OnDiskPreview) timed out after ${FFPROBE_TIMEOUT_MS}ms — killing`
				);
				try {
					child.kill("SIGKILL");
				} catch (e) {
					log.debug(`ffprobe process: kill-error @271: ${String(e)}`);
				}
			}, FFPROBE_TIMEOUT_MS);
			child.stdout.on("data", d => {
				out += d;
			});
			child.stderr.on("data", d => {
				err += d;
			});
			await new Promise<void>((resolve, reject) => {
				child.on("error", e => reject(e));
				child.on("close", (code, signal) => {
					clearTimeout(killer);
					if (code === 0) {
						return resolve();
					}
					reject(
						new Error(
							`ffprobe exit code ${code} signal ${signal ?? "none"} stderr=${String(
								err
							)}`
						)
					);
				});
			});
			return JSON.parse(out);
		} finally {
			await fs.rm(tmpdir, { recursive: true, force: true }).catch(e => {
				log.debug(`fs rm error @301: ${String(e)}`);
			});
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
