const Video = require("../../../../common/video");
const NeverthinkAdapter = require("../../../../server/services/neverthink");

const validVideoLinks = [
	["230987772", "https://neverthink.tv/v/230987772"],
	["230988315", "https://neverthink.tv/v/230988315"],
];

const invalidLinks = ["https://neverthink.tv"];

const videoSampleResponses = {
	"230987772": {
		"aspectRatio": 1,
		"channelId": 862,
		"chatChannelId": "yt-G0Z9s9yzxm0",
		"deletedFromOrigin": false,
		"description": "Please click",
		"duration": 19,
		"id": "G0Z9s9yzxm0",
		"likeCount": 4,
		"origin": "yt",
		"publishedOnOriginAt": "2020-09-14T00:04:19.000Z",
		"shareUrl": "https://neverthink.tv/v/230987772",
		"shareId": null,
		"thumbnailUrl": "https://img.youtube.com/vi/G0Z9s9yzxm0/mqdefault.jpg",
		"title": "Pablo Rochat is back at it 🤣 #netflix",
		"urlAtOrigin": "https://youtu.be/G0Z9s9yzxm0",
		"originAccountId": 445415,
		"urlId": "230987772",
		"creator": {
			"name": "BTW",
			"partner": false,
			"youtubeUrl": "https://youtube.com/channel/UCKbwnoMSUPbylcucU6HmYtA",
		},
	},
	"230988315":{
		"aspectRatio": 1.33333333333333,
		"channelId": 862,
		"chatChannelId": "yt-gfAGzUIkyDU",
		"deletedFromOrigin": false,
		"description": null,
		"duration": 19,
		"id": "gfAGzUIkyDU",
		"likeCount": 13,
		"origin": "yt",
		"publishedOnOriginAt": null,
		"shareUrl": "https://neverthink.tv/v/230988315",
		"shareId": null,
		"thumbnailUrl": "https://img.youtube.com/vi/gfAGzUIkyDU/mqdefault.jpg",
		"title": "Sick of Roommates stealing my food",
		"urlAtOrigin": "https://youtu.be/gfAGzUIkyDU",
		"originAccountId": 21678,
		"urlId": "230988315",
		"creator": {
			"name": "newton2013",
			"partner": false,
			"youtubeUrl": "https://youtube.com/channel/UCMVr7QJRaSGgeyCQ1QqL0Sw",
		},
	},
};

const samplePlaylist = {
	videos: [
		"G0Z9s9yzxm0",
		"nt:3c736cbb6be04c2b564ddf93cb364473:gfAGzUIkyDU",
		"vimeo:502630513",
	],
};

const sampleInit = {
	channels: [
		{
			urlFragment: "the-internet",
			playlist: {
				urlPlain: "https://neverthink.tv/playlists/167/b4f8c6a9c4b45bf16b17431ec9adbd56aa0dd4ba02ebe7720de0600b17404bd4-v5-plain.json",
			},
		},
	],
};

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

	it.each(validVideoLinks)("Parses %s", (id, link) => {
		expect(adapter.getVideoId(link)).toEqual(id);
	});
});

describe("resolveURL", () => {
	const adapter = new NeverthinkAdapter();

	it("should resolve single video urls", async () => {
		jest.spyOn(adapter.api, 'get').mockResolvedValue({ data: videoSampleResponses["230987772"] });

		let video = await adapter.resolveURL("https://neverthink.tv/v/230987772");
		expect(video).toEqual(new Video({
			service: "youtube",
			id: "G0Z9s9yzxm0",
			title: "Pablo Rochat is back at it 🤣 #netflix",
			description: "Please click",
			thumbnail: "https://img.youtube.com/vi/G0Z9s9yzxm0/mqdefault.jpg",
			length: 19,
		}));
	});

	it("should resolve playlist url", async () => {
		jest.spyOn(adapter.fetch, 'get').mockResolvedValue({ data: samplePlaylist });

		let videos = await adapter.resolveURL("https://neverthink.tv/playlists/167/b4f8c6a9c4b45bf16b17431ec9adbd56aa0dd4ba02ebe7720de0600b17404bd4-v5-plain.json");
		expect(videos).toEqual([
			new Video({
				service: "youtube",
				id: "G0Z9s9yzxm0",
			}),
			new Video({
				service: "youtube",
				id: "gfAGzUIkyDU",
			}),
			new Video({
				service: "vimeo",
				id: "502630513",
			}),
		]);
	});

	it("should resolve neverthink channel", async () => {
		jest.spyOn(adapter.api, 'get').mockResolvedValue({ data: sampleInit });
		jest.spyOn(adapter.fetch, 'get').mockResolvedValue({ data: samplePlaylist });

		let videos = await adapter.resolveURL("https://neverthink.tv/the-internet");
		expect(videos).toEqual([
			new Video({
				service: "youtube",
				id: "G0Z9s9yzxm0",
			}),
			new Video({
				service: "youtube",
				id: "gfAGzUIkyDU",
			}),
			new Video({
				service: "vimeo",
				id: "502630513",
			}),
		]);
	});
});
