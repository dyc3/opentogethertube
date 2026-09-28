import { eq } from "drizzle-orm";
import { getDb } from "../database/client.js";
import type { CachedVideoRow } from "../database/schema/types.js";

export type CachedVideoCreationAttributes = Omit<CachedVideoRow, "id" | "createdAt" | "updatedAt">;

export class CachedVideo implements CachedVideoRow {
	declare id: number;
	declare service: string;
	declare serviceId: string;
	declare title: string | null;
	declare description: string | null;
	declare thumbnail: string | null;
	declare length: number | null;
	declare mime: string | null;
	declare createdAt: Date;
	declare updatedAt: Date;
	declare dataValues: this;

	constructor(values: Partial<CachedVideoRow> = {}) {
		Object.assign(this, values);
		Object.defineProperty(this, "dataValues", {
			enumerable: false,
			get: () => ({ ...this }),
		});
	}

	async destroy() {
		const context = getDb();
		if (context.dialect === "postgres") {
			await context.db
				.delete(context.schema.cachedVideos)
				.where(eq(context.schema.cachedVideos.id, this.id));
			return;
		}
		await context.db
			.delete(context.schema.cachedVideos)
			.where(eq(context.schema.cachedVideos.id, this.id));
	}

	static async create(values: Partial<CachedVideoCreationAttributes>) {
		const context = getDb();
		const now = new Date();
		const rows =
			context.dialect === "postgres"
				? await context.db
						.insert(context.schema.cachedVideos)
						.values({ ...values, createdAt: now, updatedAt: now } as never)
						.returning()
				: await context.db
						.insert(context.schema.cachedVideos)
						.values({ ...values, createdAt: now, updatedAt: now } as never)
						.returning();
		return new CachedVideo(rows[0]);
	}

	static async bulkCreate(values: Array<Partial<CachedVideoCreationAttributes>>) {
		return Promise.all(values.map(value => CachedVideo.create(value)));
	}

	static async destroy({ where }: { where: Partial<CachedVideoRow> }) {
		const context = getDb();
		const entries = Object.entries(where);
		if (entries.length === 0) {
			if (context.dialect === "postgres") {
				const deleted = await context.db
					.delete(context.schema.cachedVideos)
					.returning({ id: context.schema.cachedVideos.id });
				return deleted.length;
			}
			const deleted = await context.db
				.delete(context.schema.cachedVideos)
				.returning({ id: context.schema.cachedVideos.id });
			return deleted.length;
		}
		const [key, value] = entries[0] as [keyof CachedVideoRow, unknown];
		const column = context.schema.cachedVideos[key as keyof typeof context.schema.cachedVideos];
		const deleted =
			context.dialect === "postgres"
				? await context.db
						.delete(context.schema.cachedVideos)
						.where(eq(column as never, value as never))
						.returning({ id: context.schema.cachedVideos.id })
				: await context.db
						.delete(context.schema.cachedVideos)
						.where(eq(column as never, value as never))
						.returning({ id: context.schema.cachedVideos.id });
		return deleted.length;
	}
}

export default CachedVideo;
