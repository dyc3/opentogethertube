import { collectDefaultMetrics, Counter, Histogram } from "prom-client";
import type { Request, Response, NextFunction } from "express";
import { getLogger } from "./logger";
const log = getLogger("metrics");

collectDefaultMetrics();

const counterHttpRequestsReceived = new Counter({
	name: "ott_http_requests_received",
	help: "The number of HTTP requests received",
	labelNames: ["http_method"],
});

const counterHttpRequestsHandled = new Counter({
	name: "ott_http_requests_handled",
	help: "The number of HTTP requests that have been handled and responded to",
	labelNames: ["http_method", "http_status"],
});

const histHttpRequestDuration = new Histogram({
	name: "ott_http_request_duration_seconds",
	help: "How long the server takes to respond to http requests",
	buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
	labelNames: ["http_method", "http_status"],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
	counterHttpRequestsReceived.labels({ http_method: req.method }).inc();
	let start = process.hrtime();
	next();
	let end = process.hrtime(start);
	histHttpRequestDuration
		.labels({ http_method: req.method, http_status: res.statusCode })
		.observe((end[0] * 1e9 + end[1]) / 1e9);
	counterHttpRequestsHandled
		.labels({ http_method: req.method, http_status: res.statusCode })
		.inc();
}
