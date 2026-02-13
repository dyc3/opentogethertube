import { assertType, expectTypeOf, describe, it } from "vitest";
import type { SystemState } from "./types";
import type { SystemState as SystemStateGenerated } from "./generated";

describe("SystemState", () => {
	it("should remain in sync with the SystemState type", () => {
		expectTypeOf<SystemState>().toMatchTypeOf<SystemStateGenerated>();
	});
});
