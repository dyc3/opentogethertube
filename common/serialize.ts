export function serializeMap<T extends Map<unknown, unknown>>(map: T): [unknown, unknown][] {
	return Array.from(map.entries());
}

export function deserializeMap<T extends [unknown, unknown][]>(kvpairs: T): Map<unknown, unknown> {
	return new Map(kvpairs);
}

export function replacer(key, value) {
	if (value instanceof Map) {
		return serializeMap(value);
	}
	else {
		return value;
	}
}
