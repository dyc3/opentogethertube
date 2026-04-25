import type { Assertion, AsymmetricMatchersContaining } from "vitest";

interface OttMatchers<R = unknown> {
	toBeRoomNotFound: () => R;
	toBeUnknownError: () => R;
}

declare module "vitest" {
	interface Assertion<T = any> extends OttMatchers<T> {}
	interface AsymmetricMatchersContaining extends OttMatchers {}
}
