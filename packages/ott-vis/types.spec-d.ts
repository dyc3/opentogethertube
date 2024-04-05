import { assertType, expectTypeOf, describe, it } from "vitest";
import { SystemState } from "./types";
import { SystemState as SystemStateGenerated } from "./generated";

describe("SystemState", () => {
	it("should remain in sync with the SystemState type", () => {
		expectTypeOf<SystemState>().toMatchTypeOf<SystemStateGenerated>();
	});
});
