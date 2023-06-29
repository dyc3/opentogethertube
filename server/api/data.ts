import { getLogger } from "../logger.js";
import { conf } from "../ott-config";
import express, { RequestHandler, ErrorRequestHandler } from "express";
import { OttApiResponseAddPreview, OttResponseBody } from "../../common/models/rest-api";
import { OttException } from "../../common/exceptions";
import { BadApiArgumentException } from "../exceptions";
import InfoExtract from "../infoextractor";
import { consumeRateLimitPoints } from "../rate-limit";
import { counterHttpErrors } from "../metrics";

const router = express.Router();
const log = getLogger("api/data");
const addPreview: RequestHandler<
	any,
	OttResponseBody<OttApiResponseAddPreview>,
	any,
	{ input: string }
> = async (req, res, next) => {
	let points = 5;
	if (!InfoExtract.isURL(req.query.input)) {
		points *= 15;
	}
	if (!(await consumeRateLimitPoints(res, req.ip, points))) {
		return;
	}
	try {
		log.info(`Getting queue add preview for ${req.query.input}`);
		let result = await InfoExtract.resolveVideoQuery(
			req.query.input.trim(),
			conf.get("add_preview.search.provider")
		);
		res.json({
			success: true,
			result,
		});
		log.info(`Sent add preview response with ${result.length} items`);
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
			err.name === "VideoNotFoundException"
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
				message: "An unknown error occured. Try again later.",
			},
		});
	}
};

export default router;
