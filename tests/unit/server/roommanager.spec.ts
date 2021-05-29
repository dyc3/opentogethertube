import roommanager from "../../../server/roommanager";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Room } from "../../../models";

describe("Room manager", () => {
	beforeEach(async () => {
		await Room.destroy({ where: {} });
	});

	describe("creating a room", () => {
		it("should never save null to permissions or user role columns", async () => {
			await roommanager.CreateRoom({ name: "test", isTemporary: false });
			const room = await Room.findOne({ where: { name: "test" } });
			expect(room.permissions).not.toBeNull();
			expect(room.permissions).toEqual('{"0":4095,"1":4095,"2":4095,"3":3149823,"4":4194303,"-1":4194303}');
			expect(room["role-admin"]).not.toBeNull();
			expect(room["role-mod"]).not.toBeNull();
			expect(room["role-trusted"]).not.toBeNull();
		});
	});
});
