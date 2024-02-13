import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import usermanager from "../../usermanager";
import { conf } from "../../../server/ott-config";
import { FeatureDisabledException } from "../../exceptions";

describe("Usermanager spec", () => {
	beforeEach(() => {
		conf.set("users.enable_registration", true);
	});

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

	it("should not register social user when registration is disabled", () => {
		conf.set("users.enable_registration", false);

		expect(
			usermanager.registerUserSocial({
				username: "foo",
				discordId: "123456789",
			})
		).rejects.toThrow(FeatureDisabledException);
	});
});
