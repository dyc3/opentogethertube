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
import { FfprobeTimeoutError } from "./exceptions.js";
import { conf } from "./ott-config.js";

const log = getLogger("infoextract/ffprobe");

// Hard ffprobe, 35 Seconds.
const FFPROBE_TIMEOUT_MS = 35000;

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

// Fixes multi spawn ffprobe
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

// Ensure no ffprobe child processes are left running when Node.js is terminated.
// On normal exit or termination signals (SIGINT, SIGTERM) we clean up
// all registered ffprobe children to prevent zombie processes.

// Node.js terminates via exit
process.once("exit", () => killAllFfprobeChildren("process_exit"));
// Node.js terminates via Ctrl + C command
process.once("SIGINT", () => killAllFfprobeChildren("sigint"));
// Node.js terminates via OS Kill execution. Linux/Mac: Kill or service manager, Windows: taskkill or EndTask
process.once("SIGTERM", () => killAllFfprobeChildren("sigterm"));

function streamDataIntoFfprobe(
	ffprobePath: string,
	stream: Stream,
	controller: AbortController
): Promise<string> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const resolveOnce = (v: string) => {
			if (!settled) {
				settled = true;
				resolve(v);
			}
		};
		const rejectOnce = (e: unknown) => {
			if (!settled) {
				settled = true;
				reject(e as Error);
			}
		};

		let args = ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", "-"];
		let child = childProcess.spawn(ffprobePath, args, {
			stdio: "pipe",
			windowsHide: true,
		});
		registerFfprobeChild(child);
		log.debug(`ffprobe child spawned: ${child.pid}`);
		let resultJson = "";

		let timedOut = false;
		let hardKiller: NodeJS.Timeout | null = setTimeout(() => {
			log.warn(
				`ffprobe pid=${child.pid} exceeded hard timeout ${FFPROBE_TIMEOUT_MS}ms — killing`
			);
			try {
				timedOut = true;
				child.kill("SIGKILL");
			} catch (e) {
				log.debug(`ffprobe hard-kill error: ${String(e)}`);
			}
			try {
				controller.abort();
			} catch (e) {
				if (!axios.isCancel(e)) {
					log.debug(`abort error: ${String(e)}`);
				}
			}
		}, FFPROBE_TIMEOUT_MS);

		const clearHardKiller = () => {
			if (hardKiller) {
				clearTimeout(hardKiller);
				hardKiller = null;
			}
		};

		function finalize() {
			clearHardKiller();
			stream.removeAllListeners();
			stream.emit("end");
			try {
				controller.abort();
			} catch (e) {
				if (!axios.isCancel(e)) {
					log.error(`Failed to abort request: ${e}`);
				}
			}
			resolveOnce(resultJson);
		}

		stream.on("data", data => {
			counterBytesDownloaded.inc(data.length);
			if (child.stdin.destroyed) {
				return;
			}
			child.stdin.write(data, e => {
				if (e) {
					log.debug(`write failed (destroyed: ${child.stdin.destroyed}): ${String(e)}`);
				}
			});
		});
		child.stdin.on("error", e => {
			log.debug(`ffprobe stdin error: ${String(e)}`);
		});
		stream.on("end", () => {
			log.debug("http stream ended");
			if (child.stdin.destroyed) {
				return;
			}
			child.stdin.end();
		});
		stream.on("error", error => {
			if (!timedOut) {
				log.error(`http stream error: ${error}`);
			} else {
				log.debug(`expected stream.on error: ${error}`);
			}
			clearHardKiller();
			try {
				child.kill("SIGKILL");
			} catch (e) {
				log.error("Error while trying to destroy ffprobe:", e);
			}
			if (timedOut) {
				rejectOnce(new FfprobeTimeoutError());
			} else {
				rejectOnce(error);
			}
		});
		child.stdout.on("data", data => {
			log.debug(`ffprobe output: ${data}`);
			resultJson += data;
		});
		child.stderr.on("data", data => {
			log.silly(`${data}`);
		});
		child.on("close", (code, signal) => {
			clearHardKiller();
			log.debug(`ffprobe closed (code=${code}, signal=${signal ?? "none"})`);
			if (timedOut) {
				return rejectOnce(new FfprobeTimeoutError());
			}
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

		let timedOut = false;

		let hardKiller: NodeJS.Timeout | null = setTimeout(() => {
			log.warn(`ffprobe (run) pid=${child.pid} exceeded ${FFPROBE_TIMEOUT_MS}ms — killing`);
			try {
				timedOut = true;
				child.kill("SIGKILL");
			} catch (e) {
				log.debug(`ffprobe hard-kill error: ${String(e)}`);
			}
		}, FFPROBE_TIMEOUT_MS);
		child.stdout.on("data", d => (out += d));
		child.stderr.on("data", d => (err += d));
		await new Promise<void>((resolve, reject) => {
			child.on("error", err => {
				if (hardKiller) {
					clearTimeout(hardKiller);
					hardKiller = null;
				}
				log.error(`ffprobe spawn error (pid=${child.pid ?? "n/a"}): ${String(err)}`);
				reject(err);
			});
			child.on("close", (code, signal) => {
				if (hardKiller) {
					clearTimeout(hardKiller);
					hardKiller = null;
				}
				if (timedOut) {
					return reject(new FfprobeTimeoutError());
				}
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

			let timedOut = false;

			let hardKiller: NodeJS.Timeout | null = setTimeout(() => {
				log.warn(
					`ffprobe (ondisk) pid=${child.pid} exceeded ${FFPROBE_TIMEOUT_MS}ms — killing`
				);
				try {
					timedOut = true;
					child.kill("SIGKILL");
				} catch (e) {
					log.debug(`ffprobe hard-kill error: ${String(e)}`);
				}
			}, FFPROBE_TIMEOUT_MS);
			child.stdout.on("data", d => (out += d));
			child.stderr.on("data", d => (err += d));
			await new Promise<void>((resolve, reject) => {
				child.on("error", err => {
					if (hardKiller) {
						clearTimeout(hardKiller);
						hardKiller = null;
					}
					log.error(`ffprobe spawn error (pid=${child.pid ?? "n/a"}): ${String(err)}`);
					reject(err);
				});
				child.on("close", (code, signal) => {
					if (hardKiller) {
						clearTimeout(hardKiller);
						hardKiller = null;
					}
					if (timedOut) {
						return reject(new FfprobeTimeoutError());
					}
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
