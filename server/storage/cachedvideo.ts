import dayjs from "dayjs";
import { and, eq, or } from "drizzle-orm";
import type { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { getLogger } from "../logger.js";
import _ from "lodash";
import { getDb } from "../database/client.js";
import { cachedVideoInfoFields, type CachedVideoRow } from "../database/schema/types.js";

const log = getLogger("storage/cachedvideo");

type VideoLookup = {
	service: VideoService;
	serviceId: string;
};

type CachedVideoMutation = {
	service: VideoService;
	serviceId: string;
	title?: string;
	description?: string;
	thumbnail?: string;
	length?: number;
	mime?: string;
};

function pickDefined<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
	) as Partial<T>;
}

export async function getVideoInfo(service: VideoService, id: string): Promise<Video> {
	try {
		const context = getDb();
		const cachedVideo =
			context.dialect === "postgres"
				? await context.db.query.cachedVideos.findFirst({
						where: (cachedVideos, { and, eq }) =>
							and(eq(cachedVideos.service, service), eq(cachedVideos.serviceId, id)),
				  })
				: await context.db.query.cachedVideos.findFirst({
						where: (cachedVideos, { and, eq }) =>
							and(eq(cachedVideos.service, service), eq(cachedVideos.serviceId, id)),
				  });
		if (cachedVideo) {
			return filterVideoInfo(cachedVideo);
		}
		log.debug(`video not found in cache ${service} ${id}`);
		return { service, id };
	} catch (err) {
		log.warn(`Cache failure ${err}`);
		return { service, id };
	}
}

export async function getManyVideoInfo(videos: Video[]): Promise<Video[]> {
	if (videos.length === 0) {
		return [];
	}

	const lookups: VideoLookup[] = videos.map(video => ({
		service: video.service,
		serviceId: video.id,
	}));

	try {
		const context = getDb();
		const whereClause = or(
			...lookups.map(video =>
				and(
					eq(context.schema.cachedVideos.service, video.service),
					eq(context.schema.cachedVideos.serviceId, video.serviceId)
				)
			)
		);
		const foundVideos =
			context.dialect === "postgres"
				? await context.db.select().from(context.schema.cachedVideos).where(whereClause)
				: await context.db.select().from(context.schema.cachedVideos).where(whereClause);

		if (lookups.length !== foundVideos.length) {
			for (const video of lookups) {
				if (!_.find(foundVideos, video)) {
					foundVideos.push(video as unknown as CachedVideoRow);
				}
			}
		}
		return foundVideos.map(filterVideoInfo);
	} catch (err) {
		log.warn(`Cache failure ${err}`);
		return lookups.map(video => ({ service: video.service, id: video.serviceId }));
	}
}

function filterVideoInfo(cachedVideo: Partial<CachedVideoRow>): Video {
	const origCreatedAt = cachedVideo.createdAt ? dayjs(cachedVideo.createdAt) : dayjs();
	const lastUpdatedAt = cachedVideo.updatedAt ? dayjs(cachedVideo.updatedAt) : dayjs();
	const today = dayjs();
	const isCachedInfoValid =
		lastUpdatedAt.diff(today, "days") <= (origCreatedAt.diff(today, "days") <= 7 ? 7 : 30);
	const video: Video = {
		service: cachedVideo.service as VideoService,
		id: cachedVideo.serviceId ?? "",
	};
	if (cachedVideo.title && isCachedInfoValid) {
		video.title = cachedVideo.title;
	}
	if (cachedVideo.description && isCachedInfoValid) {
		video.description = cachedVideo.description;
	}
	if (cachedVideo.thumbnail && isCachedInfoValid) {
		video.thumbnail = cachedVideo.thumbnail;
	}
	if (cachedVideo.length && isCachedInfoValid) {
		video.length = cachedVideo.length;
	}
	if (cachedVideo.mime) {
		video.mime = cachedVideo.mime;
	}
	return video;
}

export async function updateVideoInfo(video: Video, shouldLog = true): Promise<boolean> {
	video = _.cloneDeep(video);
	if (!video.service || !video.id) {
		log.error("video.service or video.id is not set");
		return false;
	}

	try {
		if (shouldLog) {
			log.debug(`Updating video cache: ${video.service} ${video.id}`);
		}
		const context = getDb();
		const now = new Date();
		const values = {
			...toDbVideo(video.service, video.id, video),
			createdAt: now,
			updatedAt: now,
		};
		const updateSet = {
			...pickDefined(toDbVideo(video.service, video.id, video)),
			updatedAt: now,
		};

		if (context.dialect === "postgres") {
			await context.db
				.insert(context.schema.cachedVideos)
				.values(values)
				.onConflictDoUpdate({
					target: [
						context.schema.cachedVideos.service,
						context.schema.cachedVideos.serviceId,
					],
					set: updateSet,
				});
		} else {
			await context.db
				.insert(context.schema.cachedVideos)
				.values(values)
				.onConflictDoUpdate({
					target: [
						context.schema.cachedVideos.service,
						context.schema.cachedVideos.serviceId,
					],
					set: updateSet,
				});
		}
	} catch (err) {
		log.error(`Failed to cache video info ${err}`);
		return false;
	}

	return true;
}

export async function updateManyVideoInfo(videos: Video[]): Promise<boolean> {
	videos = videos.map(video => _.cloneDeep(video));

	try {
		const results = await Promise.all(videos.map(video => updateVideoInfo(video, false)));
		return results.every(Boolean);
	} catch (err) {
		log.error(`Failed to cache video info ${err}`);
		return false;
	}
}

function toDbVideo(service: VideoService, id: string, video: Video): CachedVideoMutation {
	const dbVideo: CachedVideoMutation = {
		service,
		serviceId: id,
	};
	if (video.title !== undefined) {
		dbVideo.title = video.title;
	}
	if (video.description !== undefined) {
		dbVideo.description = video.description;
	}
	if (video.thumbnail !== undefined) {
		dbVideo.thumbnail = video.thumbnail;
	}
	if (video.length !== undefined) {
		dbVideo.length = video.length;
	}
	if (video.mime !== undefined) {
		dbVideo.mime = video.mime;
	}
	return dbVideo;
}

export function getVideoInfoFields(service?: string): (keyof VideoMetadata)[] {
	const fields: (keyof VideoMetadata)[] = [];
	for (const column of cachedVideoInfoFields) {
		if (["youtube", "vimeo"].includes(service ?? "") && column === "mime") {
			continue;
		}
		if (service === "googledrive" && column === "description") {
			continue;
		}
		fields.push(column);
	}
	return fields;
}
