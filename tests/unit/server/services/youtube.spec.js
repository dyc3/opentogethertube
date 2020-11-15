const YouTubeAdapter = require("../../../../server/services/youtube");
const Video = require("../../../../common/video");
const {
  InvalidVideoIdException,
  OutOfQuotaException,
} = require("../../../../server/exceptions");
const { redisClient } = require("../../../../redisclient");

jest
  .spyOn(redisClient, "get")
  .mockImplementation((key, callback) => callback(null, null));
jest.spyOn(redisClient, "set").mockImplementation();

const validVideoLinks = [
  ["3kw2_89ym31W", "https://youtube.com/watch?v=3kw2_89ym31W"],
  ["3kw2_89ym31W", "https://www.youtube.com/watch?v=3kw2_89ym31W"],
  ["3kw2_89ym31W", "https://youtu.be/3kw2_89ym31W"],
];

const invalidLinks = [
  "https://example.com",
  "https://youtube.com",
  "https://youtube.com/lkjsads",
  "https://youtu.be",
  "https://www.youtube.com/c/",
  "https://www.youtube.com/channel/",
  "https://www.youtube.com/watch",
  "https://www.youtube.com/playlist",
];

const validCollectionLinks = [
  "https://www.youtube.com/c/ChannelName",
  "https://www.youtube.com/channel/981g-23981g23981g298",
  "https://www.youtube.com/playlist?list=0a8shd08ahsdoih12--9as8hd",
  "https://www.youtube.com/watch?v=0hasodi12&list=9asdouihlj1293gashd",
];

const youtubeVideoListSampleResponses = {
  BTZ5KVRUy1Q:
    '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/dqnBDym87ibK6816BZIGb9MCLYI\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/UyysisXjek5qf_mfkU7W8pFnmPs\\"","id": "BTZ5KVRUy1Q","snippet": {"publishedAt": "2019-08-26T11:32:44.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpIwT4T4","description": "tmpIwT4T4","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg","width": 320,"height": 180},"high": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpIwT4T4","description": "tmpIwT4T4"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": true,"projection": "rectangular"}}]}',
  I3O9J02G67I:
    '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Ly8EM_vOONCLOEzI8TMYnzfG37k\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Xz7huLjXglgWYbMv-lMOshzynvk\\"","id": "I3O9J02G67I","snippet": {"publishedAt": "2019-07-26T13:02:54.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpATT2Cp","description": "tmpATT2Cp","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg","width": 120,"height": 90},"high": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpATT2Cp","description": "tmpATT2Cp"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": false,"projection": "rectangular"}}]}',
  "BTZ5KVRUy1Q,I3O9J02G67I":
    '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/dqnBDym87ibK6816BZIGb9MCLYI\\"","pageInfo": {"totalResults": 2,"resultsPerPage": 2},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/UyysisXjek5qf_mfkU7W8pFnmPs\\"","id": "BTZ5KVRUy1Q","snippet": {"publishedAt": "2019-08-26T11:32:44.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpIwT4T4","description": "tmpIwT4T4","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg","width": 320,"height": 180},"high": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpIwT4T4","description": "tmpIwT4T4"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": true,"projection": "rectangular"}}, {"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Xz7huLjXglgWYbMv-lMOshzynvk\\"","id": "I3O9J02G67I","snippet": {"publishedAt": "2019-07-26T13:02:54.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpATT2Cp","description": "tmpATT2Cp","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg","width": 120,"height": 90},"high": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpATT2Cp","description": "tmpATT2Cp"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": false,"projection": "rectangular"}}]}',
};

const channelInfoSampleResponses = [
  {
    data: {
      items: [
        {
          contentDetails: {
            relatedPlaylists: { uploads: "channeluploadplaylistid" },
          },
        },
      ],
    },
  },
];

const emptyPlaylistItemsResponse = {
  data: {
    items: [],
  },
};

describe("canHandleURL", () => {
  const adapter = new YouTubeAdapter("");

  it.each(validVideoLinks.map((l) => l[1]).concat(validCollectionLinks))(
    "Accepts %s",
    (link) => {
      expect(adapter.canHandleURL(link)).toBe(true);
    }
  );

  it.each(invalidLinks)("Rejects %s", (link) => {
    expect(adapter.canHandleURL(link)).toBe(false);
  });
});

describe("isCollectionURL", () => {
  const adapter = new YouTubeAdapter("");

  it.each(validVideoLinks.map((l) => l[1]))("Returns false for %s", (link) => {
    expect(adapter.isCollectionURL(link)).toBe(false);
  });

  it.each(validCollectionLinks)("Returns true for %s", (link) => {
    expect(adapter.isCollectionURL(link)).toBe(true);
  });
});

describe("getVideoId", () => {
  const adapter = new YouTubeAdapter("");

  it.each(validVideoLinks)("Extracts %s from %s", (id, link) => {
    expect(adapter.getVideoId(link)).toBe(id);
  });
});

describe("fetchVideoInfo", () => {
  const adapter = new YouTubeAdapter("");
  const apiGet = jest.fn();
  const videoId = "BTZ5KVRUy1Q";
  apiGet.mockReturnValue(
    Promise.resolve({
      data: JSON.parse(youtubeVideoListSampleResponses[videoId]),
    })
  );
  adapter.api.get = apiGet;

  beforeEach(() => {
    apiGet.mockClear();
  });

  it("Returns a promise", () => {
    expect(adapter.fetchVideoInfo(videoId)).toBeInstanceOf(Promise);
  });

  it("Queries the YouTube API", async () => {
    await adapter.fetchVideoInfo(videoId);
    expect(apiGet).toBeCalled();
  });

  it("Returns a video", async () => {
    const video = await adapter.fetchVideoInfo(videoId);
    expect(video).toBeInstanceOf(Video);
  });

  it("Throws an error if videoId is invalid", () => {
    return expect(adapter.fetchVideoInfo("")).rejects.toThrowError(
      InvalidVideoIdException
    );
  });
});

describe("resolveURL", () => {
  const adapter = new YouTubeAdapter("", redisClient);
  const apiGet = jest.spyOn(adapter.api, "get");

  beforeEach(() => {
    apiGet.mockClear();
  });

  // TODO: Think of something to test here

  it("Resolves channel URLs", async () => {
    const channelId = "89hasd9h2lalskh8";
    const channelURL = `https://www.youtube.com/channel/${channelId}`;

    apiGet
      .mockResolvedValueOnce(channelInfoSampleResponses[0])
      .mockResolvedValueOnce(emptyPlaylistItemsResponse);

    await adapter.resolveURL(channelURL);
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(apiGet).toHaveBeenNthCalledWith(1, "/channels", {
      params: expect.objectContaining({ id: channelId }),
    });
    expect(apiGet).toHaveBeenNthCalledWith(2, "/playlistItems", {
      params: expect.objectContaining({
        playlistId: "channeluploadplaylistid",
      }),
    });
  });

  it("Resolves user URLs", async () => {
    const userName = "someuserthatdoesntactuallyexists";
    const channelURL = `https://www.youtube.com/user/${userName}`;

    apiGet
      .mockResolvedValueOnce(channelInfoSampleResponses[0])
      .mockResolvedValueOnce(emptyPlaylistItemsResponse);

    await adapter.resolveURL(channelURL);
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(apiGet).toHaveBeenNthCalledWith(1, "/channels", {
      params: expect.objectContaining({ forUsername: userName }),
    });
    expect(apiGet).toHaveBeenNthCalledWith(2, "/playlistItems", {
      params: expect.objectContaining({
        playlistId: "channeluploadplaylistid",
      }),
    });
  });
});

describe("searchVideos", () => {
  const adapter = new YouTubeAdapter("");
  const apiGet = jest.spyOn(adapter.api, "get");

  beforeEach(() => {
    apiGet.mockClear();
  });

  it("Queries the YouTube API for videos", async () => {
    apiGet.mockResolvedValue({ data: { items: [] } });
    const searchQuery = "Testing";

    await adapter.searchVideos(searchQuery);

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("/search", {
      params: expect.objectContaining({ q: searchQuery }),
    });
  });

  it("Reports out of quota errors", async () => {
    apiGet.mockRejectedValue({ response: { status: 403 } });

    await expect(adapter.searchVideos("")).rejects.toThrow(OutOfQuotaException);
  });

  it("Re-throws all other errors", async () => {
    const response = { response: { status: 400 } };
    apiGet.mockRejectedValue(response);

    const promise = adapter.searchVideos("");
    await expect(promise).rejects.toEqual(response);
    await expect(promise).rejects.not.toBeInstanceOf(OutOfQuotaException);
  });
});
