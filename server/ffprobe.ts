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

// Timeout in ms how long the watchdog will wait until ffprobe exits itself if not sigkill
const FFPROBE_TIMEOUT_MS = 30000;

// Track all spawned ffprobe children so we can always clean them up.
const FFPROBE_CHILDREN = new Set<childProcess.ChildProcess>();

function registerFfprobeChild(child: childProcess.ChildProcess): void {
	try {
		FFPROBE_CHILDREN.add(child);
		log.debug(`registered ffprobe child pid=${child.pid}, total now=${FFPROBE_CHILDREN.size}`);
		// auto-unregister when the child exits
		child.once("close", () => {
			FFPROBE_CHILDREN.delete(child);
			log.debug(
				`unregistered ffprobe child pid=${child.pid}, total now=${FFPROBE_CHILDREN.size}`
			);
		});
	} catch (e) {
		log.debug(`registerFfprobeChild error: ${String(e)}`);
	}
}

function killAllFfprobeChildren(reason: string): void {
	if (FFPROBE_CHILDREN.size === 0) {
		log.debug(`killAllFfprobeChildren: no lingering children (reason=${reason})`);
		return;
	}
	log.warn(
		`killAllFfprobeChildren: cleaning up ${FFPROBE_CHILDREN.size} children (reason=${reason})`
	);
	for (const c of FFPROBE_CHILDREN) {
		try {
			log.warn(`killing lingering ffprobe pid=${c.pid}`);
			c.kill("SIGKILL");
		} catch (e) {
			log.debug(`killAllFfprobeChildren error: ${String(e)}`);
		}
	}
	FFPROBE_CHILDREN.clear();
}

// Best-effort cleanup on shutdown paths
process.once("exit", () => killAllFfprobeChildren("process_exit"));
process.once("SIGINT", () => {
	killAllFfprobeChildren("SIGINT");
	process.exit(130);
});
process.once("SIGTERM", () => {
	killAllFfprobeChildren("SIGTERM");
	process.exit(143);
});

function streamDataIntoFfprobe(
	ffprobePath: string,
	stream: Stream,
	controller: AbortController
): Promise<string> {
	return new Promise((resolve, reject) => {
		//let streamEnded = false; dead code?
		let args = ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", "-"];
		let child = childProcess.spawn(ffprobePath, args, {
			stdio: "pipe",
			windowsHide: true,
		});
		registerFfprobeChild(child);
		log.debug(`ffprobe child spawned: ${child.pid}`);
		let resultJson = "";

		// Watchdog
		let killer: NodeJS.Timeout | null = null;
		const armWatchdog = () => {
			if (killer) {
				return;
			}
			log.debug(`arming ffprobe watchdog on child pid=${child.pid}`);
			killer = setTimeout(() => {
				log.warn(
					`ffprobe pid=${child.pid} did not exit within ${FFPROBE_TIMEOUT_MS}ms after input finished — killing`
				);
				try {
					child.kill("SIGKILL");
				} catch (e) {
					log.debug(`ffprobe kill error: ${String(e)}`);
				}
				try {
					controller.abort();
				} catch (e) {
					if (!axios.isCancel(e)) {
						log.debug(`abort error: ${String(e)}`);
					}
				}
			}, FFPROBE_TIMEOUT_MS);
		};
		const clearWatchdog = () => {
			if (killer) {
				log.debug(`clearing ffprobe watchdog on child pid=${child.pid}`);
				clearTimeout(killer);
				killer = null;
			}
		};

		function finalize() {
			clearWatchdog();
			stream.removeAllListeners();
			stream.emit("end");
			try {
				controller.abort();
			} catch (e) {
				if (!axios.isCancel(e)) {
					log.error(`Failed to abort request: ${e}`);
				}
			}
			resolve(resultJson);
		}

		stream.on("data", data => {
			counterBytesDownloaded.inc(data.length);
			if (child.stdin.destroyed) {
				armWatchdog();
				return;
			}
			child.stdin.write(data, e => {
				if (e) {
					log.debug(`write failed (destroyed: ${child.stdin.destroyed}): ${String(e)}`);
					armWatchdog();
				}
			});
		});
		child.stdin.on("error", e => {
			log.debug(`ffprobe stdin error: ${String(e)}`);
			armWatchdog();
		});
		stream.on("end", () => {
			log.debug("http stream ended");
			// streamEnded = true; dead code? never actually checked or used
			if (child.stdin.destroyed) {
				armWatchdog();
				return;
			}
			child.stdin.end();
			armWatchdog();
		});
		stream.on("error", error => {
			log.error(`http stream error: ${error}`);
			reject(error);
		});
		child.stdout.on("data", data => {
			log.debug(`ffprobe output: ${data}`);
			resultJson += data;
		});
		child.stderr.on("data", data => {
			log.silly(`${data}`);
		});
		child.on("close", (code, signal) => {
			clearWatchdog();
			log.debug(`ffprobe closed (code=${code}, signal=${signal ?? "none"})`);
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
		// minimal change: use spawn with args
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
		registerFfprobeChild(child);
		let out = "";
		let err = "";
		child.stdout.on("data", d => (out += d));
		child.stderr.on("data", d => (err += d));
		await new Promise<void>((resolve, reject) => {
			child.on("error", reject);
			child.on("close", (code, signal) => {
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
		}

		try {
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
			registerFfprobeChild(child);
			let out = "";
			let err = "";
			child.stdout.on("data", d => (out += d));
			child.stderr.on("data", d => (err += d));
			await new Promise<void>((resolve, reject) => {
				child.on("error", reject);
				child.on("close", (code, signal) => {
					if (code === 0) {
						return resolve();
					}
					reject(
						new Error(
							`ffprobe exit code ${code} signal ${signal ?? "none"} stderr=${err}`
						)
					);
				});
			});
			return JSON.parse(out);
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
