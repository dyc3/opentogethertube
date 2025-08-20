/* eslint-disable vitest/expect-expect */
import { assertType, describe, expectTypeOf, it } from "vitest";
import type { QueueItem } from "../../models/video.js";
import type { ConvertToJsonSafe } from "../../serialize.js";

describe("serialize helper types", () => {
	it("should convert types to a type that is actually json serializable", () => {
		expectTypeOf<ConvertToJsonSafe<Map<string, number>>>().toEqualTypeOf<[string, number][]>();
		expectTypeOf<ConvertToJsonSafe<Set<string>>>().toEqualTypeOf<string[]>();
		expectTypeOf<ConvertToJsonSafe<bigint>>().toEqualTypeOf<string>();
	});

	it("should not convert other primitive types", () => {
		expectTypeOf<ConvertToJsonSafe<number>>().toEqualTypeOf<number>();
		expectTypeOf<ConvertToJsonSafe<string>>().toEqualTypeOf<string>();
		expectTypeOf<ConvertToJsonSafe<boolean>>().toEqualTypeOf<boolean>();
		expectTypeOf<ConvertToJsonSafe<null>>().toEqualTypeOf<null>();
	});

	it("should not convert arrays of primitives", () => {
		expectTypeOf<ConvertToJsonSafe<number[]>>().toEqualTypeOf<number[]>();
	});

	it("should convert maps recursively", () => {
		expectTypeOf<ConvertToJsonSafe<Map<string, Map<string, number>>>>().toEqualTypeOf<
			[string, [string, number][]][]
		>();
	});

	it("should convert arbitrary objects recursively", () => {
		type Foo = {
			bar: Bar;
			baz: number;
			qux: Map<string, Set<number>>;
		};
		type Bar = {
			qur: Map<string, number>;
		};

		type FooSafe = {
			bar: BarSafe;
			baz: number;
			qux: [string, number[]][];
		};
		type BarSafe = {
			qur: [string, number][];
		};
		expectTypeOf<ConvertToJsonSafe<Foo>>().toEqualTypeOf<FooSafe>();
	});

	it("should handle union types", () => {
		type Foo = {
			bar: Map<string, number> | null;
		};

		type FooSafe = {
			bar: [string, number][] | null;
		};
		expectTypeOf<ConvertToJsonSafe<Foo>>().toEqualTypeOf<FooSafe>();
	});

	it("should not mangle types that are already json safe", () => {
		type Foo = {
			bar: string;
		};

		type Bar = {
			baz?: QueueItem | null;
		};

		expectTypeOf<ConvertToJsonSafe<Foo>>().toEqualTypeOf<Foo>();
		expectTypeOf<ConvertToJsonSafe<QueueItem>>().toEqualTypeOf<QueueItem>();
		expectTypeOf<ConvertToJsonSafe<QueueItem | undefined>>().toEqualTypeOf<
			QueueItem | undefined
		>();
		expectTypeOf<ConvertToJsonSafe<Bar>>().toEqualTypeOf<Bar>();
	});

	it("should handle types that have a toJSON method", () => {
		class Foo {
			toJSON() {
				return { bar: "baz" };
			}
		}

		expectTypeOf<ConvertToJsonSafe<Foo>>().toEqualTypeOf<{ bar: string }>();
	});
});
