export type Result<T, E extends Error> = Ok<T> | Err<E>;

export class Ok<T> {
	readonly ok: true = true;
	readonly value: T;

	constructor(value: T) {
		this.value = value;
	}
}

export class Err<E extends Error> {
	readonly ok: false = false;
	readonly value: E;

	constructor(value: E) {
		this.value = value;
	}
}

export function ok<T>(value: T): Ok<T> {
	return new Ok(value);
}

export function err<E extends Error>(value: E): Err<E> {
	return new Err(value);
}

export function intoResult<T>(func: () => T): Result<T, Error> {
	try {
		const result = func();
		return ok(result);
	} catch (e) {
		return err(e);
	}
}
