// biome-ignore lint/correctness/noUnusedImports: migrating to biome
import type { Assertion, AsymmetricMatchersContaining } from "vitest";

interface OttMatchers<R = unknown> {
	toBeRoomNotFound: () => R;
	toBeUnknownError: () => R;
}

declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: biome migration
	interface Assertion<T = any> extends OttMatchers<T> {}
	interface AsymmetricMatchersContaining extends OttMatchers {}
}
