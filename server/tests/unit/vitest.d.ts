// biome-ignore lint/correctness/noUnusedImports: biome migration
import type { Assertion, AsymmetricMatchersContaining } from "vitest";

interface OttMatchers<R = unknown> {
	toBeRoomNotFound: () => R;
	toBeUnknownError: () => R;
}

declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: biome migration
	// biome-ignore lint/nursery/noShadow: biome migration
		interface Assertion<T = any> extends OttMatchers<T> {}
	// biome-ignore lint/nursery/noShadow: biome migration
	interface AsymmetricMatchersContaining extends OttMatchers {}
}
