import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import express, { type RequestHandler, type ErrorRequestHandler } from "express";
import type { OttApiResponseAddPreview, OttResponseBody } from "ott-common/models/rest-api.js";
import { OttException } from "ott-common/exceptions.js";
import { BadApiArgumentException } from "../exceptions.js";
import InfoExtract from "../infoextractor.js";
import { consumeRateLimitPoints } from "../rate-limit.js";
import { counterHttpErrors } from "../metrics.js";
import { sanitizeLogInput } from "../util/index.js";

const router = express.Router();
const log = getLogger("api/data");
const addPreview: RequestHandler<
	any,
	OttResponseBody<OttApiResponseAddPreview>,
	any,
	{ input: string; adapter?: string }
> = async (req, res, next) => {
	if (!req.query.input) {
		throw new BadApiArgumentException("input", "missing");
	}

	let points = 5;
	if (!InfoExtract.isURL(req.query.input)) {
		points *= 15;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}
	try {
		log.info(`Getting queue add preview for ${sanitizeLogInput(req.query.input)}`);
		const result = await InfoExtract.resolveVideoQuery(
			req.query.input.trim(),
			conf.get("add_preview.search.provider"),
			req.query.adapter,
		);

		const isPrivateResponse = result.videos.some(v => v.service === "jellyfin");

		res.setHeader(
			"Cache-Control",
			isPrivateResponse
				? "private, no-cache, no-store, must-revalidate"
				: result.cacheDuration > 0
					? `public, max-age=${result.cacheDuration}, immutable, stale-while-revalidate=86400`
					: "no-store",
		);

		res.json({
			success: true,
			result: result.videos,
			highlighted: result.highlighted,
		});
		log.info(`Sent add preview response with ${result.videos.length} items`);
	} catch (err) {
		if (
			err.name === "UnsupportedServiceException" ||
			err.name === "InvalidAddPreviewInputException" ||
			err.name === "OutOfQuotaException" ||
			err.name === "InvalidVideoIdException" ||
			err.name === "FeatureDisabledException" ||
			err.name === "UnsupportedMimeTypeException" ||
			err.name === "LocalFileException" ||
			err.name === "MissingMetadataException" ||
			err.name === "UnsupportedVideoType" ||
			err.name === "UpstreamInvidiousException" ||
			err.name === "VideoNotFoundException" ||
			err.name === "FfprobeTimeoutError" ||
			err.name === "OdyseeUnavailableVideo" ||
			err.name === "JellyfinApiKeyException" ||
			err.name === "OttException"
		) {
			log.error(`Unable to get add preview: ${err.name}`);
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
		} else {
			log.error(`Unable to get add preview: ${err} ${err.stack}`);
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "Unknown error occurred.",
				},
			});
		}
	}
};

router.get("/jellyfin/stream/:tokenRef/*", async (req, res, next) => {
	try {
		const adapter = InfoExtract.getServiceAdapter("jellyfin");
		if (!adapter || !("proxyStream" in adapter)) {
			res.status(404).send("Jellyfin service not available");
			return;
		}
		const subpath = (req.params as any)[0] || "master.m3u8";
		await (adapter as any).proxyStream(req.params.tokenRef, subpath, req.query, req, res);
	} catch (e) {
		errorHandler(e as Error, req, res, next);
	}
});

router.get("/jellyfin/stream/:tokenRef", async (req, res, next) => {
	try {
		const adapter = InfoExtract.getServiceAdapter("jellyfin");
		if (!adapter || !("proxyStream" in adapter)) {
			res.status(404).send("Jellyfin service not available");
			return;
		}
		await (adapter as any).proxyStream(req.params.tokenRef, "master.m3u8", req.query, req, res);
	} catch (e) {
		errorHandler(e as Error, req, res, next);
	}
});

router.get(
	"/jellyfin/subtitles/:tokenRef/:mediaSourceId/:index/stream.vtt",
	async (req, res, next) => {
		try {
			const adapter = InfoExtract.getServiceAdapter("jellyfin");
			if (!adapter || !("proxySubtitle" in adapter)) {
				res.status(404).send("Jellyfin service not available");
				return;
			}
			await (adapter as any).proxySubtitle(
				req.params.tokenRef,
				req.params.mediaSourceId,
				Number.parseInt(req.params.index, 10),
				res,
			);
		} catch (e) {
			errorHandler(e as Error, req, res, next);
		}
	},
);

router.get("/previewAdd", async (req, res, next) => {
	try {
		// @ts-expect-error the type definition for query parameters makes ts angry, but its correct
		await addPreview(req, res, next);
	} catch (e) {
		errorHandler(e, req, res, next);
	}
});

const errorHandler: ErrorRequestHandler = (err: Error, req, res) => {
	counterHttpErrors.labels({ error: err.name }).inc();
	if (err instanceof OttException) {
		log.debug(`OttException: path=${req.path} name=${err.name}`);
		if (err.name === "BadApiArgumentException") {
			const e = err as BadApiArgumentException;
			res.status(400).json({
				success: false,
				error: {
					name: "BadApiArgumentException",
					message: err.message,
					arg: e.arg,
					reason: e.reason,
				},
			});
		} else {
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
		}
	} else {
		log.error(`Unhandled exception: path=${req.path} ${err.name} ${err.message} ${err.stack}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "An unknown error occurred. Try again later.",
			},
		});
	}
};

export default router;
