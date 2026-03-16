import { describe, it, expect } from "@jest/globals";
import { plugin } from "./module";

describe("Example", () => {
	it("should be true", () => {
		expect(plugin).toBeDefined();
	});
});
