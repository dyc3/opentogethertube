export function serializeMap<T extends Map<unknown, unknown>>(map: T): [unknown, unknown][] {
	return Array.from(map.entries());
}

export function deserializeMap<T extends [unknown, unknown][]>(kvpairs: T): Map<unknown, unknown> {
	return new Map(kvpairs);
}

export function serializeSet<T extends Set<unknown>>(set: T): unknown[] {
	return Array.from(set);
}

export function deserializeSet<T extends unknown[]>(set: T): Set<unknown> {
	return new Set(set);
}

export function replacer(key, value) {
	if (value instanceof Map) {
		return serializeMap(value);
	}
	else if (value instanceof Set) {
		return serializeSet(value);
	}
	else {
		return value;
	}
}
