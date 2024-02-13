import { SystemState } from "types";
import { aggMonolithRooms, countRoomClients, groupMonolithsByRegion } from "./aggregate";

const sampleSystemState: SystemState = [
	{
		id: "154d9d41-128c-45ab-83d8-28661882c9e3",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 2 },
					{ name: "bar", clients: 0 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 3 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 0 }],
			},
		],
	},
	{
		id: "c91d183c-980e-4160-b196-43658148f469",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 1 },
					{ name: "bar", clients: 2 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 0 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 0 }],
			},
		],
	},
	{
		id: "5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0",
		region: "cdg",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 0 },
					{ name: "bar", clients: 0 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 0 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 4 }],
			},
		],
	},
];

describe("aggregation helpers", () => {
	it("counts room clients", () => {
		expect(countRoomClients(sampleSystemState)).toEqual({
			foo: 3,
			bar: 2,
			baz: 3,
			qux: 4,
		});
	});

	it("aggregates monolith rooms", () => {
		expect(aggMonolithRooms(sampleSystemState)).toEqual({
			"2bd5e4a7-14f6-4da4-bedd-72946864a7bf": ["foo", "bar"],
			"419580cb-f576-4314-8162-45340c94bae1": ["baz"],
			"0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac": ["qux"],
		});
	});

	it("groups monoliths by region", () => {
		expect(groupMonolithsByRegion(sampleSystemState)).toEqual({
			ewr: ["2bd5e4a7-14f6-4da4-bedd-72946864a7bf", "419580cb-f576-4314-8162-45340c94bae1"],
			cdg: ["0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac"],
		});
	});
});
