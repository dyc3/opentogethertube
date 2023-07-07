import { Role } from "../../models/types";
import permissions, { Grants, GrantMask } from "../../permissions";

describe("Permission System", () => {
	it("should parse exact permissions list into correct grant mask", () => {
		const grantMask = permissions.parseIntoGrantMask([
			"playback.play-pause",
			"manage-queue.add",
			"chat",
		]);
		expect(grantMask).toEqual((1 << 0) | (1 << 3) | (1 << 7));
	});

	it("should parse wildcard permissions list into correct grant mask", () => {
		const grantMask = permissions.parseIntoGrantMask(["playback"]);
		expect(grantMask).toEqual((1 << 0) | (1 << 1) | (1 << 2) | (1 << 23));
	});

	it("should evaluate permission grants accurately", () => {
		const grants: Grants = new Grants(
			new Map([[Role.UnregisteredUser, (1 << 0) | (1 << 1) | (1 << 2)]])
		);
		expect(grants.granted(Role.UnregisteredUser, "playback.play-pause")).toEqual(true);
		expect(grants.granted(Role.UnregisteredUser, "chat")).toEqual(false);
	});

	it("should evaluate invalid permission as false", () => {
		const grants: Grants = new Grants(
			new Map([[Role.UnregisteredUser, (1 << 0) | (1 << 1) | (1 << 2)]])
		);
		expect(grants.granted(Role.UnregisteredUser, null as unknown as PermissionName)).toEqual(
			false
		); // invalid because null
		expect(
			grants.granted(Role.UnregisteredUser, undefined as unknown as PermissionName)
		).toEqual(false); // invalid because undefined
	});

	it("should evaluate inherited permission grants accurately", () => {
		const grants: Grants = new Grants(
			new Map([
				[Role.UnregisteredUser, (1 << 0) | (1 << 1) | (1 << 2)],
				[Role.RegisteredUser, (1 << 3) | (1 << 4) | (1 << 7)],
				[Role.TrustedUser, 1 << 8],
			])
		);
		expect(grants.granted(Role.UnregisteredUser, "playback.play-pause")).toEqual(true);
		expect(grants.granted(Role.UnregisteredUser, "manage-queue.add")).toEqual(false);
		expect(grants.granted(Role.UnregisteredUser, "chat")).toEqual(false);
		expect(grants.granted(Role.UnregisteredUser, "configure-room.set-title")).toEqual(false);
		expect(grants.granted(Role.RegisteredUser, "playback.play-pause")).toEqual(true);
		expect(grants.granted(Role.RegisteredUser, "manage-queue.add")).toEqual(true);
		expect(grants.granted(Role.RegisteredUser, "chat")).toEqual(true);
		expect(grants.granted(Role.RegisteredUser, "configure-room.set-title")).toEqual(false);
		expect(grants.granted(Role.TrustedUser, "playback.play-pause")).toEqual(true);
		expect(grants.granted(Role.TrustedUser, "chat")).toEqual(true);
		expect(grants.granted(Role.TrustedUser, "configure-room.set-title")).toEqual(true);
	});

	it("should evaluate multiple/wildcard permission grants correctly", () => {
		const grants: Grants = new Grants(
			new Map([
				[Role.UnregisteredUser, (1 << 0) | (1 << 1) | (1 << 2) | (1 << 23)],
				[Role.RegisteredUser, (1 << 3) | (1 << 4) | (1 << 7)],
				[Role.TrustedUser, 1 << 8],
			])
		);
		expect(grants.granted(Role.UnregisteredUser, "playback")).toEqual(true);
		expect(grants.granted(Role.UnregisteredUser, "manage-queue")).toEqual(false);
	});

	it("should get correct validation mask", () => {
		expect(permissions.getValidationMask(0) & 0b111111111111).toEqual(0b111111111111);
		expect(permissions.getValidationMask(0) & (1 << 22)).toEqual(1 << 22);
		expect(permissions.getValidationMask(3) & ((1 << 13) | (1 << 14) | (1 << 15))).toEqual(
			(1 << 13) | (1 << 14) | (1 << 15)
		);
	});

	it("should guarentee that using numbers for roles works for Grants", () => {
		const grants = new Grants({ "0": 4095 });
		expect(grants.getMask(0)).toEqual(4095);
	});

	describe("Serialization", () => {
		it("should deserialize old format", () => {
			const grants = new Grants();
			grants.deserialize(`{"0":128,"1":4094,"2":4094,"3":4094,"4":4094,"-1":4194303}`);
			expect(grants.getMask(Role.UnregisteredUser)).toEqual(128);
			expect(grants.getMask(Role.RegisteredUser)).toEqual(4094);
			expect(grants.getMask(Role.TrustedUser)).toEqual(4094);
			expect(grants.getMask(Role.Moderator)).toEqual(4094);
			expect(grants.getMask(Role.Administrator)).toEqual(4094);
		});

		it("should enforce inheritance during deserialization", () => {
			const grants = new Grants();
			grants.deserialize(`{"0":129,"1":4094,"2":4094,"3":4094,"4":4094,"-1":4194303}`);
			expect(grants.getMask(Role.UnregisteredUser)).toEqual(129);
			expect(grants.getMask(Role.RegisteredUser)).toEqual(4095);
			expect(grants.getMask(Role.TrustedUser)).toEqual(4095);
			expect(grants.getMask(Role.Moderator)).toEqual(4095);
			expect(grants.getMask(Role.Administrator)).toEqual(4095);
		});

		it("should stringify Grants", () => {
			const grants = new permissions.Grants();
			const str = JSON.stringify(grants);
			expect(str).toMatch(/^\[.*\]$/);
			expect(str.length).toBeGreaterThan(2);
			expect(str).not.toContain("mask");
		});

		it("should not serialize into empty things", () => {
			const grants = new Grants();
			const ser = grants.serialize();
			expect(ser).not.toEqual("{}");
			expect(ser).not.toEqual("[]");
			expect(ser.length).toBeGreaterThan(2);
		});

		it("should serialize then deserialize", () => {
			const grants = new Grants();
			grants.setRoleGrants(Role.UnregisteredUser, (1 << 0) | (1 << 1) | (1 << 7));
			grants.setRoleGrants(
				Role.RegisteredUser,
				(1 << 0) | (1 << 1) | (1 << 3) | (1 << 4) | (1 << 7)
			);
			grants.setRoleGrants(
				Role.TrustedUser,
				(1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 7)
			);
			const ser = grants.serialize();
			const deser = new Grants();
			deser.deserialize(ser);
			for (let i = Role.UnregisteredUser; i <= Role.Administrator; i++) {
				expect(deser.getMask(i)).toEqual(grants.getMask(i));
			}
		});
	});
});
