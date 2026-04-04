import { eq } from "drizzle-orm";
import { getDb } from "../database/client.js";
import type { RoomRow } from "../database/schema/types.js";

export type RoomAttributes = RoomRow;

export class Room implements RoomRow {
	declare "id": number;
	declare "name": string;
	declare "title": string;
	declare "description": string;
	declare "visibility": RoomRow["visibility"];
	declare "queueMode": RoomRow["queueMode"];
	declare "ownerId": number | null;
	declare "permissions": RoomRow["permissions"];
	declare "role-admin": number[] | null;
	declare "role-mod": number[] | null;
	declare "role-trusted": number[] | null;
	declare "autoSkipSegmentCategories": RoomRow["autoSkipSegmentCategories"];
	declare "prevQueue": RoomRow["prevQueue"];
	declare "restoreQueueBehavior": RoomRow["restoreQueueBehavior"];
	declare "enableVoteSkip": boolean;
	declare "createdAt": Date;
	declare "updatedAt": Date;
	declare "dataValues": this;

	"constructor"(values: Partial<RoomRow> & { visibility?: string; queueMode?: string } = {}) {
		Object.assign(this, values);
		Object.defineProperty(this, "dataValues", {
			enumerable: false,
			get: () => ({ ...this }),
		});
	}

	async "destroy"() {
		return Room.destroy({ where: { id: this.id } });
	}

	static async "findOne"({ where }: { where: Partial<RoomRow> }) {
		const context = getDb();
		const key = Object.keys(where)[0] as keyof RoomRow | undefined;
		const value = key ? where[key] : undefined;
		if (!key) {
			return null;
		}
		const column = context.schema.rooms[key as keyof typeof context.schema.rooms];
		const rows =
			context.dialect === "postgres"
				? await context.db
						.select()
						.from(context.schema.rooms)
						.where(eq(column as never, value as never))
						.limit(1)
				: await context.db
						.select()
						.from(context.schema.rooms)
						.where(eq(column as never, value as never))
						.limit(1);
		return rows[0] ? new Room(rows[0] as never) : null;
	}

	static async "destroy"({ where }: { where: Partial<RoomRow> }) {
		const context = getDb();
		const entries = Object.entries(where);
		if (entries.length === 0) {
			if (context.dialect === "postgres") {
				const deleted = await context.db
					.delete(context.schema.rooms)
					.returning({ id: context.schema.rooms.id });
				return deleted.length;
			}
			const deleted = await context.db
				.delete(context.schema.rooms)
				.returning({ id: context.schema.rooms.id });
			return deleted.length;
		}
		const [key, value] = entries[0] as [keyof RoomRow, unknown];
		const column = context.schema.rooms[key as keyof typeof context.schema.rooms];
		const deleted =
			context.dialect === "postgres"
				? await context.db
						.delete(context.schema.rooms)
						.where(eq(column as never, value as never))
						.returning({ id: context.schema.rooms.id })
				: await context.db
						.delete(context.schema.rooms)
						.where(eq(column as never, value as never))
						.returning({ id: context.schema.rooms.id });
		return deleted.length;
	}
}

export default Room;
