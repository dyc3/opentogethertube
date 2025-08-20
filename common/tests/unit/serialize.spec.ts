import { describe, expect, it } from "vitest";
import { deserializeMap, deserializeSet, replacer } from "../../serialize.js";

describe("Serialize helpers", () => {
	describe("JSON with replacer round trips", () => {
		it("should de/serialize maps", () => {
			const map = new Map([
				["a", 1],
				["b", 2],
			]);
			const serialized = JSON.stringify(map, replacer);
			const map2 = deserializeMap(JSON.parse(serialized));
			expect(map2).toEqual(map);
		});

		it("should de/serialize sets", () => {
			const set = new Set([1, 2]);
			const serialized = JSON.stringify(set, replacer);
			const set2 = deserializeSet(JSON.parse(serialized));
			expect(set2).toEqual(set);
		});

		it("should handle BigInts", () => {
			const bigInt = 123n;
			const serialized = JSON.stringify(bigInt, replacer);
			const bigInt2 = JSON.parse(serialized);
			expect(bigInt2).toEqual("123");
		});
	});
});
