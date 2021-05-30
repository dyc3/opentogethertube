import permissions from "../../../server/permissions.js";

describe('Permission System', () => {
	it('should parse exact permissions list into correct grant mask', () => {
		const grantMask = permissions.parseIntoGrantMask([
			"playback.play-pause",
			"manage-queue.add",
			"chat",
		]);
		expect(grantMask).toEqual(1<<0 | 1<<3 | 1<<7);
	});

	it('should parse wildcard permissions list into correct grant mask', () => {
		const grantMask = permissions.parseIntoGrantMask(["playback"]);
		expect(grantMask).toEqual(1<<0 | 1<<1 | 1<<2);
	});

	it('should evaluate permission grants accurately', () => {
		const grants = {
			0: 1<<0 | 1<<1 | 1<<2,
		};
		expect(permissions.granted(grants, 0, "playback.play-pause")).toEqual(true);
		expect(permissions.granted(grants, 0, "chat")).toEqual(false);
	});

	it('should evaluate invalid permission as false', () => {
		const grants = {
			0: 1<<0 | 1<<1 | 1<<2,
		};
		expect(permissions.granted(grants, 0, null)).toEqual(false); // invalid because null
		expect(permissions.granted(grants, 0, undefined)).toEqual(false); // invalid because undefined
	});

	it('should evaluate inherited permission grants accurately', () => {
		const grants = {
			0: 1<<0 | 1<<1 | 1<<2,
			1: 1<<3 | 1<<4 | 1<<7,
			2: 1<<8,
		};
		expect(permissions.granted(grants, 0, "playback.play-pause")).toEqual(true);
		expect(permissions.granted(grants, 0, "manage-queue.add")).toEqual(false);
		expect(permissions.granted(grants, 0, "chat")).toEqual(false);
		expect(permissions.granted(grants, 0, "configure-room.set-title")).toEqual(false);
		expect(permissions.granted(grants, 1, "playback.play-pause")).toEqual(true);
		expect(permissions.granted(grants, 1, "manage-queue.add")).toEqual(true);
		expect(permissions.granted(grants, 1, "chat")).toEqual(true);
		expect(permissions.granted(grants, 1, "configure-room.set-title")).toEqual(false);
		expect(permissions.granted(grants, 2, "playback.play-pause")).toEqual(true);
		expect(permissions.granted(grants, 2, "chat")).toEqual(true);
		expect(permissions.granted(grants, 2, "configure-room.set-title")).toEqual(true);
	});

	it('should evaluate multiple/wildcard permission grants correctly', () => {
		const grants = {
			0: 1<<0 | 1<<1 | 1<<2,
			1: 1<<3 | 1<<4 | 1<<7,
			2: 1<<8,
		};
		expect(permissions.granted(grants, 0, "playback")).toEqual(true);
		expect(permissions.granted(grants, 0, "manage-queue")).toEqual(false);
	});

	it('should get correct validation mask', () => {
		expect(permissions.getValidationMask(0)).toEqual(0b111111111111);
		expect(permissions.getValidationMask(3) & (1<<13 | 1<<14 | 1<<15)).toEqual(1<<13 | 1<<14 | 1<<15);
	});

	it('should stringify Grants', () => {
		const grants = new permissions.Grants();
		const str = JSON.stringify(grants);
		expect(str).toMatch(/^\{.*\}$/);
		expect(str.length).toBeGreaterThan(2);
		expect(str).not.toContain("mask");
	});

	it('should guarentee that using numbers for roles works for Grants', () => {
		const grants = new permissions.Grants({"0":4095});
		expect(grants.masks[0]).toEqual(4095);
		expect(grants.masks[0]).toEqual(4095);
	});
});
