import { deserializeMap, deserializeSet, replacer } from "../../serialize";

describe("Serialize helpers", () => {
	describe("JSON with replacer round trips", () => {
		it("should de/serialize maps", () => {
			const map = new Map();
			map.set("a", 1);
			map.set("b", 2);
			const serialized = JSON.stringify(map, replacer);
			const map2 = deserializeMap(JSON.parse(serialized));
			expect(map2).toEqual(map);
		});

		it("should de/serialize sets", () => {
			const set = new Set();
			set.add(1);
			set.add(2);
			const serialized = JSON.stringify(set, replacer);
			const set2 = deserializeSet(JSON.parse(serialized));
			expect(set2).toEqual(set);
		});
	});
});
