/* eslint-disable no-unused-vars */
import type { NonNever } from "ts-essentials";

/**
 * Takes an object type and a type condition, and returns a new object whose
 * value is either equal to the key or never, based on whether or not the value
 * extends the type of the condition.
 */
type NeverIfMatch<T, Cond> = {
	[P in keyof T]: T[P] extends Cond ? never : P;
};
type NeverIfNotMatch<T, Cond> = {
	[P in keyof T]: T[P] extends Cond ? P : never;
};

/**
 * Takes a type, and filters out all keys whose values extend
 * the type `Cond`.
 */
export type OmitTypes<T, Cond> = Pick<T, NeverIfMatch<T, Cond>[keyof T]>;
/**
 * Takes a type, and includes all keys whose values extend
 * the type `Cond`.
 */
export type PickTypes<T, Cond> = Pick<T, NeverIfNotMatch<T, Cond>[keyof T]>;

export type NeverIfArg1NotMatch<T, Cond> = {
	[P in keyof T]: T[P] extends (arg: unknown) => Promise<void>
		? Parameters<T[P]>[0] extends Cond
			? P
			: never
		: never;
};

export type NeverIfArg2NotMatch<T, Arg1, Arg2> = {
	[P in keyof T]: T[P] extends (arg: unknown, arg2: unknown) => Promise<void>
		? (Parameters<T[P]>[0] extends Arg1 ? P : never) &
				(Parameters<T[P]>[1] extends Arg2 ? P : never)
		: never;
};

export type HasNoArgs<T> = {
	[P in keyof T]: T[P] extends (arg: never) => Promise<void>
		? Parameters<T[P]>[0] extends number
			? P
			: never
		: never;
};

// export type PickFunctions<T, Arg1> = Omit<Pick<T, NeverIfArg1NotMatch<T, Arg1>[keyof T]>, keyof NonNever<HasNoArgs<T>>>
export type PickFunctions<T, Arg1, Arg2> = Omit<
	Pick<T, NeverIfArg2NotMatch<T, Arg1, Arg2>[keyof T]>,
	keyof NonNever<HasNoArgs<T>>
>;

// expands object types one level deep - useful for debugging types
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// expands object types recursively - useful for debugging types
export type ExpandRecursively<T> = T extends object
	? T extends infer O
		? { [K in keyof O]: ExpandRecursively<O[K]> }
		: never
	: T;
