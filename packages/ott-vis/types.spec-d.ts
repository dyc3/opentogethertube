import { assertType, describe, expectTypeOf, it } from "vitest";
import { SystemState as SystemStateGenerated } from "./generated";
import { SystemState } from "./types";

describe("SystemState", () => {
	it("should remain in sync with the SystemState type", () => {
		expectTypeOf<SystemState>().toMatchTypeOf<SystemStateGenerated>();
	});
});
