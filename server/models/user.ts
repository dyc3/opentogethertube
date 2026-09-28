import { eq } from "drizzle-orm";
import type { UserAccountAttributes } from "ott-common/models/types.js";
import { getDb } from "../database/client.js";

export type UserCreationAttributes = Omit<UserAccountAttributes, "id">;

export class User implements UserAccountAttributes {
	declare id: number;
	declare username: string;
	declare email: string | null;
	declare salt: Buffer | null;
	declare hash: Buffer | null;
	declare discordId: string | null;
	declare createdAt?: Date;
	declare updatedAt?: Date;
	declare dataValues: this;

	constructor(values: Partial<User> = {}) {
		this.id = values.id ?? 0;
		this.username = values.username ?? "";
		this.email = values.email ?? null;
		this.salt = values.salt ?? null;
		this.hash = values.hash ?? null;
		this.discordId = values.discordId ?? null;
		this.createdAt = values.createdAt;
		this.updatedAt = values.updatedAt;
		Object.defineProperty(this, "dataValues", {
			enumerable: false,
			get: () => ({ ...this }),
		});
	}

	async save() {
		const context = getDb();
		const rows =
			context.dialect === "postgres"
				? await context.db
						.update(context.schema.users)
						.set({
							username: this.username,
							email: this.email,
							salt: this.salt,
							hash: this.hash,
							discordId: this.discordId,
							updatedAt: new Date(),
						})
						.where(eq(context.schema.users.id, this.id))
						.returning()
				: await context.db
						.update(context.schema.users)
						.set({
							username: this.username,
							email: this.email,
							salt: this.salt,
							hash: this.hash,
							discordId: this.discordId,
							updatedAt: new Date(),
						})
						.where(eq(context.schema.users.id, this.id))
						.returning();
		Object.assign(this, rows[0]);
		return this;
	}

	async reload() {
		const fresh = await User.findOne({ where: { id: this.id } });
		if (fresh) {
			Object.assign(this, fresh);
		}
		return this;
	}

	async destroy() {
		const context = getDb();
		if (context.dialect === "postgres") {
			await context.db
				.delete(context.schema.users)
				.where(eq(context.schema.users.id, this.id));
			return;
		}
		await context.db.delete(context.schema.users).where(eq(context.schema.users.id, this.id));
	}

	static async create(values: Partial<UserCreationAttributes>) {
		const context = getDb();
		const now = new Date();
		const rows =
			context.dialect === "postgres"
				? await context.db
						.insert(context.schema.users)
						.values({
							username: values.username ?? "",
							email: values.email ?? null,
							salt: values.salt ?? null,
							hash: values.hash ?? null,
							discordId: values.discordId ?? null,
							createdAt: now,
							updatedAt: now,
						})
						.returning()
				: await context.db
						.insert(context.schema.users)
						.values({
							username: values.username ?? "",
							email: values.email ?? null,
							salt: values.salt ?? null,
							hash: values.hash ?? null,
							discordId: values.discordId ?? null,
							createdAt: now,
							updatedAt: now,
						})
						.returning();
		return new User(rows[0]);
	}

	static async findOne({ where }: { where: Partial<User> }) {
		const context = getDb();
		const key = Object.keys(where)[0] as keyof User | undefined;
		const value = key ? where[key] : undefined;
		if (!key) {
			return null;
		}
		const column = context.schema.users[key as keyof typeof context.schema.users];
		const rows =
			context.dialect === "postgres"
				? await context.db
						.select()
						.from(context.schema.users)
						.where(eq(column as never, value as never))
						.limit(1)
				: await context.db
						.select()
						.from(context.schema.users)
						.where(eq(column as never, value as never))
						.limit(1);
		return rows[0] ? new User(rows[0]) : null;
	}
}

export default User;
