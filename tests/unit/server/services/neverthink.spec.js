const NeverthinkAdapter = require("../../../../server/services/neverthink");

const validVideoLinks = [
	["230987772", "https://neverthink.tv/v/230987772"],
	["230988315", "https://neverthink.tv/v/230988315"],
];

const invalidLinks = ["https://neverthink.tv"];

describe("canHandleURL", () => {
	const adapter = new NeverthinkAdapter();

	it.each(validVideoLinks.map(v => v[1]))("Accepts %s", (link) => {
		expect(adapter.canHandleURL(link)).toBe(true);
	});

	it.each(invalidLinks)("Rejects %s", (link) => {
		expect(adapter.canHandleURL(link)).toBe(false);
	});
});

describe("isCollectionURL", () => {
	const adapter = new NeverthinkAdapter();

	it.each(validVideoLinks.map(v => v[1]))("Non-collection: %s", (link) => {
		expect(adapter.isCollectionURL(link)).toBe(false);
	});
});

describe("getVideoId", () => {
	const adapter = new NeverthinkAdapter();

	it.each(validVideoLinks)("Accepts %s", (id, link) => {
		expect(adapter.getVideoId(link)).toEqual(id);
	});
});
