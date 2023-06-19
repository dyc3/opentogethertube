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

export function replacer(key, value) {
	if (value instanceof Map) {
		return serializeMap(value);
	} else if (value instanceof Set) {
		return serializeSet(value);
	} else {
		return value;
	}
}
