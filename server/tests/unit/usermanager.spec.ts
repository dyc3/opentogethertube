// biome-ignore lint/correctness/noUnusedImports: biome migration
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conf } from "../../../server/ott-config.js";
import { main } from "../../app.js";
import { FeatureDisabledException } from "../../exceptions.js";
import { User as UserModel } from "../../models/index.js";
import type { User } from "../../models/user.js";
import usermanager from "../../usermanager.js";

describe("Usermanager spec", () => {
	// biome-ignore lint/suspicious/noImplicitAnyLet: biome migration
	// biome-ignore lint/correctness/noUnusedVariables: biome migration
		let app;

	// Initialize the application before running tests to set up database connections,
	// models, and other dependencies required for user management operations
	beforeAll(async () => {
		app = (await main()).app;
	});

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

	it("should handle accounts created with secure-password hashes gracefully", async () => {
		// This test verifies that accounts created before the migration to argon2
		// (which uses argon2 hashes but were created before the secure-password removal)
		// still work correctly after the migration is complete

		const email = "old@test.me";
		const username = "oldAccount";
		const password = "3DdDjg@Dz^#y";
		const salt = Buffer.from(
			"e62afa7b4cc00183c70e2b519278a670133f64e4804bd0e50c380628a775ad7dc3ec5c0e0c26f7d0feca20e3c2438eaebe6a7459359f9b0770a873aa85eccfab660d27aa98df6c39db2b91eac45d479a6e22c1750c4b050b312ff000bdcaf414fa97d0b3f971f7a91489b68f9cc0b16d51f45efe43db34788b3ef6ff2ffde5b3",
			"hex"
		);
		// This hash decodes to: $argon2id$v=19$m=65536,t=2,p=1$gfg2I3YsUxGUZ7eSsVFv2g$E+mZmqlRi44Y6B33d4ao0MgIDQEHccvpJOWO7kKpOvs
		const hash = Buffer.from(
			"246172676f6e32696424763d3139246d3d36353533362c743d322c703d31246766673249335973557847555a37655373564676326724452b6d5a6d716c5269343459364233336434616f304d674944514548636376704a4f574f376b4b704f767300000000000000000000000000000000000000000000000000000000000000",
			"hex"
		);
		// Create a test user with a hardcoded hash from the old secure-password library
		const testUser = await UserModel.create({
			email: email,
			username: username,
			salt: salt,
			hash: hash,
		});

		try {
			// Test authentication with argon2 library
			const result = await new Promise<User | false>((resolve, reject) => {
				usermanager.authCallback(email, password, (error, user) => {
					if (error) {
						reject(error);
					} else {
						resolve(user);
					}
				});
			});

			// Should successfully authenticate
			expect(result).toBeTruthy();
		} finally {
			await testUser.destroy();
		}
	});
});
