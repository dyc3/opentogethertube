import type { SystemState } from "ott-vis";
import { buildGraph } from "./components/views/GlobalView";

const sampleSystemState: SystemState = [
	{
		id: "154d9d41-128c-45ab-83d8-28661882c9e3",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: Array.from({ length: 50 }, (_, i) => ({ name: `room${i}`, clients: i })),
			},
		],
	},
];

describe("buildGraph function with a SystemState that has more than the max limit of room nodes", () => {
	it("should filter out every other room node and double the radius of a room node", () => {
		const [nodes] = buildGraph(sampleSystemState);
		const roomNodes = nodes.filter((node: any) => node.group === "room");
		expect(roomNodes).toHaveLength(25);
		roomNodes.forEach((node: any) => {
			expect(node.radius).toBe(14);
		});
	});
});
