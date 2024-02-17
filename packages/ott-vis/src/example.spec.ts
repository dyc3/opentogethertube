import { describe, it, expect } from "vitest";
import { plugin } from "./module";

describe("Example", () => {
	it("should be true", () => {
		expect(plugin).toBeDefined();
	});
});
