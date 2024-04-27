import type { Monolith, Room, SystemState } from "ott-vis";
import {
	aggMonolithRooms,
	countRoomClients,
	dedupeMonoliths,
	dedupeRooms,
	groupMonolithsByRegion,
} from "./aggregate";

const sampleSystemState: SystemState = [
	{
		id: "154d9d41-128c-45ab-83d8-28661882c9e3",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{
						name: "foo",
						clients: [
							{
								id: "e7229053-89df-428d-a37c-4b669fd57788",
								edge_region: "ewr",
							},
							{
								id: "3fc0f726-2ad7-438b-8b2c-bae675dc1178",
								edge_region: "ewr",
							},
						],
					},
					{ name: "bar", clients: [] },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [
					{
						name: "baz",
						clients: [
							{
								id: "a90a98eb-5c82-44b3-90e0-1d117a9444c4",
								edge_region: "ewr",
							},
							{
								id: "a7a40762-0308-408a-b954-d3f7dc2e5732",
								edge_region: "ewr",
							},
							{
								id: "0ef93318-4b39-4b56-9180-637a9abeae9e",
								edge_region: "ewr",
							},
						],
					},
				],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: [] }],
			},
			{
				id: "f21df607-b572-4bdd-aa2f-3fead21bba86",
				region: "cdg",
				rooms: [],
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
					{
						name: "foo",
						clients: [
							{
								id: "e7229053-89df-428d-a37c-4b669fd57788",
								edge_region: "ewr",
							},
						],
					},
					{
						name: "bar",
						clients: [
							{ id: "4a6fe051-3247-4cad-860a-cb455ee65923", edge_region: "ewr" },
							{ id: "33bbcd19-2af5-4244-9d71-cb647acc1b06", edge_region: "ewr" },
						],
					},
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: [] }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: [] }],
			},
			{
				id: "f21df607-b572-4bdd-aa2f-3fead21bba86",
				region: "cdg",
				rooms: [],
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
					{ name: "foo", clients: [] },
					{ name: "bar", clients: [] },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: [] }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [
					{
						name: "qux",
						clients: [
							{ id: "d3be3464-efd5-41a1-b145-7d54378b02e3", edge_region: "ewr" },
							{ id: "acc449cc-4748-435d-96b8-63530beac3d8", edge_region: "ewr" },
							{ id: "9d2ff554-8388-4021-8467-5dfb208bd66e", edge_region: "ewr" },
							{ id: "ff68188f-f739-46df-9bd7-dd25c1026651", edge_region: "ewr" },
						],
					},
				],
			},
			{
				id: "f21df607-b572-4bdd-aa2f-3fead21bba86",
				region: "cdg",
				rooms: [],
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
			"f21df607-b572-4bdd-aa2f-3fead21bba86": [],
		});
	});

	it("groups monoliths by region", () => {
		expect(groupMonolithsByRegion(sampleSystemState)).toEqual({
			ewr: ["2bd5e4a7-14f6-4da4-bedd-72946864a7bf", "419580cb-f576-4314-8162-45340c94bae1"],
			cdg: ["0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac", "f21df607-b572-4bdd-aa2f-3fead21bba86"],
		});
	});

	it("dedupes rooms", () => {
		const rooms: Room[] = [
			{
				name: "foo",
				clients: [{ id: "ff0ac5e0-caa8-4d5f-aba1-0c4aaa2d6f9e", edge_region: "ewr" }],
			},
			{
				name: "bar",
				clients: [
					{ id: "e36d4eb5-f526-4566-b94f-8cfc6dbf8548", edge_region: "ewr" },
					{ id: "e842eeef-ef6c-4095-acc7-6342fb8c8b8c", edge_region: "ewr" },
				],
			},
			{
				name: "foo",
				clients: [{ id: "f7d5d57f-d15f-48b0-b30c-9bb378ce4943", edge_region: "ewr" }],
			},
		];
		expect(dedupeRooms(rooms)).toEqual([
			{
				name: "foo",
				clients: [
					{ id: "ff0ac5e0-caa8-4d5f-aba1-0c4aaa2d6f9e", edge_region: "ewr" },
					{ id: "f7d5d57f-d15f-48b0-b30c-9bb378ce4943", edge_region: "ewr" },
				],
			},
			{
				name: "bar",
				clients: [
					{ id: "e36d4eb5-f526-4566-b94f-8cfc6dbf8548", edge_region: "ewr" },
					{ id: "e842eeef-ef6c-4095-acc7-6342fb8c8b8c", edge_region: "ewr" },
				],
			},
		]);
	});

	it("dedupes rooms using sample data", () => {
		const rooms = sampleSystemState.flatMap(b => b.monoliths.flatMap(m => m.rooms));
		expect(dedupeRooms(rooms)).toEqual([
			{
				name: "foo",
				clients: [
					{ id: "e7229053-89df-428d-a37c-4b669fd57788", edge_region: "ewr" },
					{ id: "3fc0f726-2ad7-438b-8b2c-bae675dc1178", edge_region: "ewr" },
					{ id: "e7229053-89df-428d-a37c-4b669fd57788", edge_region: "ewr" },
				],
			},
			{
				name: "bar",
				clients: [
					{ id: "4a6fe051-3247-4cad-860a-cb455ee65923", edge_region: "ewr" },
					{ id: "33bbcd19-2af5-4244-9d71-cb647acc1b06", edge_region: "ewr" },
				],
			},
			{
				name: "baz",
				clients: [
					{ id: "a90a98eb-5c82-44b3-90e0-1d117a9444c4", edge_region: "ewr" },
					{ id: "a7a40762-0308-408a-b954-d3f7dc2e5732", edge_region: "ewr" },
					{ id: "0ef93318-4b39-4b56-9180-637a9abeae9e", edge_region: "ewr" },
				],
			},
			{
				name: "qux",
				clients: [
					{ id: "d3be3464-efd5-41a1-b145-7d54378b02e3", edge_region: "ewr" },
					{ id: "acc449cc-4748-435d-96b8-63530beac3d8", edge_region: "ewr" },
					{ id: "9d2ff554-8388-4021-8467-5dfb208bd66e", edge_region: "ewr" },
					{ id: "ff68188f-f739-46df-9bd7-dd25c1026651", edge_region: "ewr" },
				],
			},
		]);
	});

	it("dedupes monoliths", () => {
		const monoliths: Monolith[] = [
			{
				id: "a",
				region: "x",
				rooms: [
					{
						name: "foo",
						clients: [
							{ id: "b379bce7-bd7a-4d79-a6bd-010e4fba1789", edge_region: "ewr" },
							{ id: "a4505c5f-4856-49af-be53-77cabcb13aad", edge_region: "ewr" },
						],
					},
				],
			},
			{ id: "b", region: "x", rooms: [] },
			{
				id: "a",
				region: "x",
				rooms: [
					{
						name: "foo",
						clients: [
							{ id: "379fdf91-e1e5-47b3-ac0c-0380a51c3479", edge_region: "ewr" },
						],
					},
				],
			},
		];
		expect(dedupeMonoliths(monoliths)).toEqual([
			{
				id: "a",
				region: "x",
				rooms: [
					{
						name: "foo",
						clients: [
							{ id: "b379bce7-bd7a-4d79-a6bd-010e4fba1789", edge_region: "ewr" },
							{ id: "a4505c5f-4856-49af-be53-77cabcb13aad", edge_region: "ewr" },
							{ id: "379fdf91-e1e5-47b3-ac0c-0380a51c3479", edge_region: "ewr" },
						],
					},
				],
			},
			{ id: "b", region: "x", rooms: [] },
		]);
	});
});
