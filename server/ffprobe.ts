import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { getLogger } from "./logger.js";
import childProcess from "child_process";
import axios from "axios";
import type { Readable } from "stream";
import fs from "fs/promises";
import path from "path";
import { pipeline as streamPipeline } from "stream/promises";
// FIXME: remove node-abort-controller package when we stop supporting node 14.
import { AbortController } from "node-abort-controller";
import http from "http";
import https from "https";
import { Counter } from "prom-client";
import { conf } from "./ott-config.js";
import { redisClient } from "./redisclient.js";

const log = getLogger("infoextract/ffprobe");

// ffprobe Timeout in ms 45000 = 45 secs more then enough Time as described in #1056 (30s)
const FFPROBE_TIMEOUT_MS = 45000;

// Cache TTL (in ms) - 1 hour
const FFPROBE_CACHE_TTL_MS = 3600000;

function makeFfprobeCacheKey(uri: string): string {
	return `ott:ffprobe:v1:${uri}`;
}

function streamDataIntoFfprobe(
	ffprobePath: string,
	stream: Readable,
	controller: AbortController
): Promise<string> {
	return new Promise((resolve, reject) => {
		const STRATEGY = "stream";
		// Guard to avoid multiple resolve/reject and to squelch late errors
		let settled = false;
		let aborted = false;
		let pipeBroken = false;
		const resolveOnce = (val: string) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(val);
		};

		const rejectOnce = (err: unknown) => {
			if (settled) {
				return;
			}
			settled = true;
			reject(err as Error);
		};

		const abortUpstreamOnce = () => {
			if (aborted) {
				return;
			}
			aborted = true;
			try {
				controller.abort();
			} catch (e: any) {
				log.debug(`ffprobe process: controller-abort error: ${String(e)}`);
			}
			try {
				(stream as any)?.pause?.();
			} catch (e: any) {
				log.debug(String(e));
			}
			try {
				(stream as any)?.destroy?.();
			} catch (e: any) {
				log.debug(String(e));
			}
		};

		// Spawn ffprobe and feed data via stdin (no shell).
		const args = ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", "-"];
		const child = childProcess.spawn(ffprobePath, args, {
			stdio: "pipe",
			windowsHide: true,
		});

		log.debug(`ffprobe child spawned: ${child.pid}`);
		let resultJson = "";
		let errBuf = ""; // collect stderr for better error messages

		// Watchdog: arm only AFTER input has finished (stdin closed or upstream ended).
		let killer: NodeJS.Timeout | null = null;
		let watchdogFired = false;
		let inputFinished = false;
		const armWatchdog = () => {
			if (killer || settled) {
				return;
			}
			inputFinished = true;
			killer = setTimeout(() => {
				watchdogFired = true;
				log.warn(
					`ffprobe pid=${child.pid} did not exit within ${FFPROBE_TIMEOUT_MS}ms after input finished — killing`
				);
				try {
					child.kill("SIGKILL");
				} catch (e: any) {
					log.debug(`ffprobe process: kill-error @watchdog: ${String(e)}`);
				}
				abortUpstreamOnce();
			}, FFPROBE_TIMEOUT_MS);
		};
		const clearWatchdog = () => {
			if (killer) {
				clearTimeout(killer);
				killer = null;
			}
		};

		const onData = (data: Buffer) => {
			if (settled || pipeBroken) {
				return;
			}
			counterBytesDownloaded.inc(data.length);
			// If ffprobe closed stdin, stop downloading further data.
			if (child.stdin.destroyed) {
				pipeBroken = true;
				abortUpstreamOnce();
				armWatchdog();
				return;
			}
			const ok = child.stdin.write(data, (e?: Error | null) => {
				if (e) {
					log.debug(`write failed (destroyed: ${child.stdin.destroyed}): ${String(e)}`);
					pipeBroken = true;
					abortUpstreamOnce();
					armWatchdog();
				}
			});
			// Handle backpressure: pause upstream until ffprobe drains stdin.
			if (!ok) {
				try {
					(stream as any)?.pause?.();
				} catch (e: any) {
					log.debug(String(e));
				}
				child.stdin.once("drain", () => {
					if (!settled && !pipeBroken) {
						try {
							(stream as any)?.resume?.();
						} catch (e: any) {
							log.debug(String(e));
						}
					}
				});
			}
		};

		stream.on("data", onData);
		child.stdin.on("error", e => {
			log.debug(`ffprobe stdin error: ${String(e)}`);
			pipeBroken = true;
			abortUpstreamOnce();
			armWatchdog();
		});

		stream.on("end", () => {
			log.debug("http stream ended");
			if (!child.stdin.destroyed) {
				child.stdin.end();
			}
			armWatchdog();
		});

		stream.on("error", error => {
			const name = (error as any)?.name;
			const code = (error as any)?.code;
			const isCancel = name === "CanceledError" || code === "ERR_CANCELED";
			log.error(
				`http stream error: ${String(error)} (settled=${settled}, aborted=${aborted})`
			);
			if (settled || aborted || isCancel) {
				return;
			}
			abortUpstreamOnce();
			rejectOnce(error);
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
			clearWatchdog();
			log.error(`ffprobe process error: ${String(err)}`);
			// Abort upstream and reject only once
			abortUpstreamOnce();
			try {
				ffprobeExits.labels(STRATEGY, "spawn_error").inc();
			} catch (e: any) {
				log.debug(String(e));
			}
			rejectOnce(err);
		});

		child.on("close", (code, signal) => {
			clearWatchdog();
			log.debug(`ffprobe closed (code=${code}, signal=${signal ?? "none"})`);
			abortUpstreamOnce();
			try {
				(stream as any)?.off?.("data", onData);
			} catch (e: any) {
				log.debug(String(e));
			}
			try {
				stream.removeAllListeners?.();
			} catch (e: any) {
				log.debug(String(e));
			}
			if (code === 0) {
				try {
					ffprobeExits.labels(STRATEGY, "ok").inc();
				} catch (e: any) {
					log.debug(String(e));
				}
				return resolveOnce(resultJson);
			}
			try {
				ffprobeExits
					.labels(STRATEGY, watchdogFired ? "watchdog_kill" : "nonzero_exit")
					.inc();
			} catch (e: any) {
				log.debug(String(e));
			}
			rejectOnce(
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
		// Cache lookup (fast path)
		const runCacheKey = makeFfprobeCacheKey(uri);
		try {
			const hit = await redisClient.get(runCacheKey);
			if (hit) {
				log.debug(`ffprobe cache hit (run) for ${uri}`);
				return JSON.parse(hit);
			}
		} catch (e: any) {
			log.debug(`ffprobe cache get error (run): ${String(e)}`);
		}
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
		const STRATEGY = "run";
		let out = "";
		let err = "";

		let timedOut = false;
		const killer = setTimeout(() => {
			timedOut = true;
			log.warn(`ffprobe (RunFfprobe) timed out after ${FFPROBE_TIMEOUT_MS}ms — killing`);
			try {
				child.kill("SIGKILL");
			} catch (e: any) {
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
			child.on("error", e => {
				try {
					ffprobeExits.labels(STRATEGY, "spawn_error").inc();
				} catch (e: any) {
					log.debug(String(e));
				}
				reject(e);
			});
			child.on("close", (code, signal) => {
				clearTimeout(killer);
				if (code === 0) {
					try {
						ffprobeExits.labels(STRATEGY, "ok").inc();
					} catch (e: any) {
						log.debug(String(e));
					}
					return resolve();
				}
				try {
					ffprobeExits.labels(STRATEGY, timedOut ? "timeout_kill" : "nonzero_exit").inc();
				} catch (e: any) {
					log.debug(String(e));
				}
				reject(
					new Error(`ffprobe exit code ${code} signal ${signal ?? "none"} stderr=${err}`)
				);
			});
		});
		const runParsed = JSON.parse(out);
		try {
			await redisClient.set(runCacheKey, JSON.stringify(runParsed), {
				PX: FFPROBE_CACHE_TTL_MS,
			});
			log.debug(`ffprobe cache set (run) for ${uri} TTL=${FFPROBE_CACHE_TTL_MS}ms`);
		} catch (e: any) {
			log.debug(`ffprobe cache set error (run): ${String(e)}`);
		}
		return runParsed;
	}
}

export class OnDiskPreviewFfprobe extends FfprobeStrategy {
	async getFileInfo(uri: string): Promise<any> {
		log.debug(`Grabbing file info from ${uri}`);

		// Cache lookup (fast path)
		const diskCacheKey = makeFfprobeCacheKey(uri);
		try {
			const hit = await redisClient.get(diskCacheKey);
			if (hit) {
				log.debug(`ffprobe cache hit (ondisk) for ${uri}`);
				return JSON.parse(hit);
			}
		} catch (e: any) {
			log.debug(`ffprobe cache get error (ondisk): ${String(e)}`);
		}

		// Create a unique temp dir and clean it later.
		const tmpdir = await fs.mkdtemp("/tmp/ott-");
		const tmpfile = path.join(tmpdir, "preview");
		log.debug(`saving preview to ${tmpfile}`);
		let handle = await fs.open(tmpfile, "w");

		const httpAgent = new http.Agent({ keepAlive: false });
		const httpsAgent = new https.Agent({ keepAlive: false });
		const controller = new AbortController();
		let resp = await axios.get<Readable>(uri, {
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

			// Ensure file is fully written; if we aborted on purpose, ignore cancel-related errors
			try {
				await streamPipeline(
					resp.data as unknown as NodeJS.ReadableStream,
					handle.createWriteStream() as unknown as NodeJS.WritableStream
				);
			} catch (e: any) {
				const name = e?.name;
				const code = e?.code;
				// Axios abort → CanceledError/ERR_CANCELED, Node stream abort → ERR_STREAM_PREMATURE_CLOSE
				const isExpectedAbort =
					name === "CanceledError" ||
					code === "ERR_CANCELED" ||
					code === "ERR_STREAM_PREMATURE_CLOSE" ||
					code === "ABORT_ERR";
				if (isExpectedAbort) {
					log.debug(`preview download aborted intentionally: ${String(e)}`);
				} else {
					log.debug(String(e));
					throw e;
				}
			}
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
			const STRATEGY = "ondisk";
			let out = "";
			let err = "";
			let timedOut = false;
			const killer = setTimeout(() => {
				timedOut = true;
				log.warn(
					`ffprobe (OnDiskPreview) timed out after ${FFPROBE_TIMEOUT_MS}ms — killing`
				);
				try {
					child.kill("SIGKILL");
				} catch (e: any) {
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
				child.on("error", e => {
					try {
						ffprobeExits.labels(STRATEGY, "spawn_error").inc();
					} catch (e: any) {
						log.debug(String(e));
					}
					reject(e);
				});
				child.on("close", (code, signal) => {
					clearTimeout(killer);
					if (code === 0) {
						try {
							ffprobeExits.labels(STRATEGY, "ok").inc();
						} catch (e: any) {
							log.debug(String(e));
						}
						return resolve();
					}
					try {
						ffprobeExits
							.labels(STRATEGY, timedOut ? "timeout_kill" : "nonzero_exit")
							.inc();
					} catch (e: any) {
						log.debug(String(e));
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
			const diskParsed = JSON.parse(out);
			// Cache store (slow path → write back)
			try {
				await redisClient.set(diskCacheKey, JSON.stringify(diskParsed), {
					PX: FFPROBE_CACHE_TTL_MS,
				});
				log.debug(`ffprobe cache set (ondisk) for ${uri} TTL=${FFPROBE_CACHE_TTL_MS}ms`);
			} catch (e: any) {
				log.debug(`ffprobe cache set error (ondisk): ${String(e)}`);
			}
			return diskParsed;
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

		// Cache lookup (fast path)
		const streamCacheKey = makeFfprobeCacheKey(uri);
		try {
			const hit = await redisClient.get(streamCacheKey);
			if (hit) {
				log.debug(`ffprobe cache hit (stream) for ${uri}`);
				return JSON.parse(hit);
			}
		} catch (e: any) {
			log.debug(`ffprobe cache get error (stream): ${String(e)}`);
		}

		const httpAgent = new http.Agent({ keepAlive: false });
		const httpsAgent = new https.Agent({ keepAlive: false });
		const controller = new AbortController();
		let resp = await axios.get<Readable>(uri, {
			responseType: "stream",
			signal: controller.signal,
			httpAgent,
			httpsAgent,
		});
		try {
			let stdout = await streamDataIntoFfprobe(this.ffprobePath, resp.data, controller);
			const streamParsed = JSON.parse(stdout);
			try {
				await redisClient.set(streamCacheKey, JSON.stringify(streamParsed), {
					PX: FFPROBE_CACHE_TTL_MS,
				});
				log.debug(`ffprobe cache set (stream) for ${uri} TTL=${FFPROBE_CACHE_TTL_MS}ms`);
			} catch (e: any) {
				log.debug(`ffprobe cache set error (stream): ${String(e)}`);
			}
			return streamParsed;
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

const ffprobeExits = new Counter({
	name: "ott_infoextractor_ffprobe_exits_total",
	help: "Count of ffprobe exits by strategy and result",
	labelNames: ["strategy", "result"],
});
