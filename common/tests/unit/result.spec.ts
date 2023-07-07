import { Result, ok, err, intoResult, intoResultAsync } from "../../result";

describe("Result", () => {
	it("intoResult", () => {
		const result = intoResult(() => {
			return 1;
		});
		expect(result.ok).toEqual(true);
		expect(result.unwrap()).toEqual(1);
		const result1 = intoResult(() => {
			throw new Error("test error");
		});
		expect(result1.ok).toEqual(false);
	});

	it("intoResultAsync", async () => {
		const result = await intoResultAsync(async () => {
			return 1;
		});
		expect(result.ok).toEqual(true);
		expect(result.unwrap()).toEqual(1);
		const result1 = await intoResultAsync(async () => {
			throw new Error("test error");
		});
		expect(result1.ok).toEqual(false);
	});

	describe("unwrap", () => {
		it("ok", () => {
			const result: Result<number, Error> = ok(1);
			expect(result.ok).toEqual(true);
			expect(result.unwrap()).toEqual(1);
		});

		it("err", () => {
			const result: Result<number, Error> = err(new Error("test error"));
			expect(result.ok).toEqual(false);
			expect(() => result.unwrap()).toThrowError("test error");
		});
	});
});
