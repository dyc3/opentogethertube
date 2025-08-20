export function serializeMap<K, V>(map: Map<K, V>): [K, V][] {
	return Array.from(map.entries());
}

export function deserializeMap<K, V>(kvpairs: [K, V][]): Map<K, V> {
	return new Map(kvpairs);
}

export function serializeSet<T>(set: Set<T>): T[] {
	return Array.from(set);
}

export function deserializeSet<T>(set: T[]): Set<T> {
	return new Set(set);
}

export function replacer<T>(key, value: T): ConvertToJsonSafe<T> {
	if (value instanceof Map) {
		return serializeMap(value) as ConvertToJsonSafe<T>;
	} else if (value instanceof Set) {
		return serializeSet(value) as ConvertToJsonSafe<T>;
	} else if (typeof value === "bigint") {
		return value.toString() as ConvertToJsonSafe<T>;
	} else {
		return value as ConvertToJsonSafe<T>;
	}
}

export type ConvertToJsonSafe<T> = T extends Map<infer K, infer V>
	? [ConvertToJsonSafe<K>, ConvertToJsonSafe<V>][]
	: T extends Set<infer U>
		? ConvertToJsonSafe<U>[]
		: T extends bigint
			? string
			: T extends null | undefined | string | number | boolean
				? T
				: T extends { toJSON(): infer R }
					? R
					: T extends object
						? {
								[P in keyof T]: T[P] extends ConvertToJsonSafe<T[P]>
									? T[P]
									: ConvertToJsonSafe<T[P]>;
							}
						: T;
