const usermanager = require('../../usermanager.js');

describe('Usermanager spec', () => {
	it("should check passwords correctly", () => {
		expect(usermanager.isPasswordValid("aaaa1234")).toBe(true);
		expect(usermanager.isPasswordValid("AAAA1111")).toBe(true);
		expect(usermanager.isPasswordValid("AAAA$$$$")).toBe(true);
		expect(usermanager.isPasswordValid("1111$$$$")).toBe(true);
		expect(usermanager.isPasswordValid("aaaa$$$$")).toBe(true);
		expect(usermanager.isPasswordValid("aaaaAAAA")).toBe(true);

		expect(usermanager.isPasswordValid("aaa$$$")).toBe(false);
		expect(usermanager.isPasswordValid("")).toBe(false);
		expect(usermanager.isPasswordValid("aaaaaaaaaaaaaa")).toBe(false);
		expect(usermanager.isPasswordValid("AAAAAAAAAAAAAA")).toBe(false);
		expect(usermanager.isPasswordValid("$$$$$$$$$$$$$$")).toBe(false);
		expect(usermanager.isPasswordValid("11111111111111")).toBe(false);
	});
});
