import YouTubeAdapter from "../../../../server/services/youtube";
import { Video } from "../../../../common/models/video";
import { InvalidVideoIdException, OutOfQuotaException } from "../../../../server/exceptions";
import { redisClient } from "../../../../redisclient";
import { Callback } from "redis";

jest
  .spyOn(redisClient, "get")
  .mockImplementation((key: string, callback?: Callback<string>) => {
    callback(null, null); return true;
  });
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
  "https://youtu.be/3kw2_89ym31W?list=PL4d83g68ij3l45kj6345hFaEHvzLovtb",
];

const youtubeVideoListSampleResponses = {
  BTZ5KVRUy1Q:
    '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/dqnBDym87ibK6816BZIGb9MCLYI\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/UyysisXjek5qf_mfkU7W8pFnmPs\\"","id": "BTZ5KVRUy1Q", "status":{ "privacyStatus": "public" }, "snippet": {"publishedAt": "2019-08-26T11:32:44.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpIwT4T4","description": "tmpIwT4T4","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg","width": 320,"height": 180},"high": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpIwT4T4","description": "tmpIwT4T4"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": true,"projection": "rectangular"}}]}',
  I3O9J02G67I:
    '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Ly8EM_vOONCLOEzI8TMYnzfG37k\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Xz7huLjXglgWYbMv-lMOshzynvk\\"","id": "I3O9J02G67I", "status":{ "privacyStatus": "public" }, "snippet": {"publishedAt": "2019-07-26T13:02:54.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpATT2Cp","description": "tmpATT2Cp","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg","width": 120,"height": 90},"high": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpATT2Cp","description": "tmpATT2Cp"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": false,"projection": "rectangular"}}]}',
  "BTZ5KVRUy1Q,I3O9J02G67I":
    '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/dqnBDym87ibK6816BZIGb9MCLYI\\"","pageInfo": {"totalResults": 2,"resultsPerPage": 2},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/UyysisXjek5qf_mfkU7W8pFnmPs\\"","id": "BTZ5KVRUy1Q", "status":{ "privacyStatus": "public" }, "snippet": {"publishedAt": "2019-08-26T11:32:44.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpIwT4T4","description": "tmpIwT4T4","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg","width": 320,"height": 180},"high": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpIwT4T4","description": "tmpIwT4T4"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": true,"projection": "rectangular"}}, {"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Xz7huLjXglgWYbMv-lMOshzynvk\\"","id": "I3O9J02G67I", "status":{ "privacyStatus": "public" }, "snippet": {"publishedAt": "2019-07-26T13:02:54.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpATT2Cp","description": "tmpATT2Cp","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg","width": 120,"height": 90},"high": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpATT2Cp","description": "tmpATT2Cp"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": false,"projection": "rectangular"}}]}',
  "zgxj_0xPleg,_3QMqssyBwQ":
    '{"kind":"youtube#videoListResponse","etag":"E6XF5WoCgCZmgde_LxQp3pGvSjw","items":[{"kind":"youtube#video","etag":"Szxkj--dpuPKhvGe4F9NT5qJDQ0","id":"zgxj_0xPleg","status":{ "privacyStatus": "public" },"snippet":{"publishedAt":"2019-02-24T21:32:40Z","channelId":"UC_3pplzbKMZsP5zBH_6SVJQ","title":"Chris Chan: A Comprehensive History - Part 1","description":"(1982-2000)","thumbnails":{"default":{"url":"https://i.ytimg.com/vi/zgxj_0xPleg/default.jpg","width":120,"height":90},"medium":{"url":"https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg","width":320,"height":180},"high":{"url":"https://i.ytimg.com/vi/zgxj_0xPleg/hqdefault.jpg","width":480,"height":360},"standard":{"url":"https://i.ytimg.com/vi/zgxj_0xPleg/sddefault.jpg","width":640,"height":480},"maxres":{"url":"https://i.ytimg.com/vi/zgxj_0xPleg/maxresdefault.jpg","width":1280,"height":720}},"channelTitle":"GenoSamuel2.1","tags":["chris chan","cwc","geno samuel","lolcow","christian weston chandler","sonichu","kiwi farms","documentary"],"categoryId":"27","liveBroadcastContent":"none","defaultLanguage":"en","localized":{"title":"Chris Chan: A Comprehensive History - Part 1","description":"(1982-2000)"},"defaultAudioLanguage":"en"},"contentDetails":{"duration":"PT40M25S","dimension":"2d","definition":"hd","caption":"true","licensedContent":false,"contentRating":{},"projection":"rectangular"}},{"kind":"youtube#video","etag":"RdhsLFF7ucTX87GY2FVg60F2Euk","id":"_3QMqssyBwQ","snippet":{"publishedAt":"2019-03-02T23:00:05Z","channelId":"UC_3pplzbKMZsP5zBH_6SVJQ","title":"Chris Chan: A Comprehensive History - Part 2","description":"(2000-2004)","thumbnails":{"default":{"url":"https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg","width":120,"height":90},"medium":{"url":"https://i.ytimg.com/vi/_3QMqssyBwQ/mqdefault.jpg","width":320,"height":180},"high":{"url":"https://i.ytimg.com/vi/_3QMqssyBwQ/hqdefault.jpg","width":480,"height":360},"standard":{"url":"https://i.ytimg.com/vi/_3QMqssyBwQ/sddefault.jpg","width":640,"height":480},"maxres":{"url":"https://i.ytimg.com/vi/_3QMqssyBwQ/maxresdefault.jpg","width":1280,"height":720}},"channelTitle":"GenoSamuel2.1","tags":["cwc","chris chan","lolcow","trolls","documentary","geno samuel","christian weston chandler","autism","sonichu"],"categoryId":"27","liveBroadcastContent":"none","defaultLanguage":"en","localized":{"title":"Chris Chan: A Comprehensive History - Part 2","description":"(2000-2004)"},"defaultAudioLanguage":"en-US"},"contentDetails":{"duration":"PT40M3S","dimension":"2d","definition":"hd","caption":"true","licensedContent":false,"contentRating":{},"projection":"rectangular"}}],"pageInfo":{"totalResults":2,"resultsPerPage":2}}',
};

const youtubePlaylistItemsSampleResponses = {
  "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm": '{"kind": "youtube#playlistItemListResponse","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/cnSEbcCodxUd20zl5d_GdkwUYHA\\"","nextPageToken": "CAIQAA","pageInfo": {"totalResults": 30,"resultsPerPage": 2},"items": [{"kind": "youtube#playlistItem","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/NuyI91BSe5o9qLD3tvex5k06aRA\\"","id": "UExBQnFFWXE2SDN2cENtc215VW5IbmZNT2VBbmpCZFNObS4wMTcyMDhGQUE4NTIzM0Y5","status":{ "privacyStatus": "public" },"snippet": {"publishedAt": "2019-03-10T02:57:27.000Z","channelId": "UC_3pplzbKMZsP5zBH_6SVJQ","title": "Chris Chan: A Comprehensive History - Part 1","description": "(1982-2000)","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/zgxj_0xPleg/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg","width": 320,"height": 180}},"channelTitle": "GenoSamuel2.1","playlistId": "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm","position": 0,"resourceId": {"kind": "youtube#video","videoId": "zgxj_0xPleg"}}}, {"kind": "youtube#playlistItem","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/yhZlmlB3rT2tcC0HpcPP0XuiTpc\\"","id": "UExBQnFFWXE2SDN2cENtc215VW5IbmZNT2VBbmpCZFNObS41NkI0NEY2RDEwNTU3Q0M2","status":{ "privacyStatus": "public" },"snippet": {"publishedAt": "2019-03-02T15:25:25.000Z","channelId": "UC_3pplzbKMZsP5zBH_6SVJQ","title": "Chris Chan: A Comprehensive History - Part 2","description": "(2000-2004)","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg","width": 120,"height": 90}},"channelTitle": "GenoSamuel2.1","playlistId": "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm","position": 1,"resourceId": {"kind": "youtube#video","videoId": "_3QMqssyBwQ"}}}]}',
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
  const adapter = new YouTubeAdapter("", redisClient);

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
  const adapter = new YouTubeAdapter("", redisClient);

  it.each(validVideoLinks.map((l) => l[1]))("Returns false for %s", (link) => {
    expect(adapter.isCollectionURL(link)).toBe(false);
  });

  it.each(validCollectionLinks)("Returns true for %s", (link) => {
    expect(adapter.isCollectionURL(link)).toBe(true);
  });
});

describe("getVideoId", () => {
  const adapter = new YouTubeAdapter("", redisClient);

  it.each(validVideoLinks)("Extracts %s from %s", (id, link) => {
    expect(adapter.getVideoId(link)).toBe(id);
  });
});

describe("fetchVideoInfo", () => {
  const adapter = new YouTubeAdapter("", redisClient);
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

  // it("Returns a video", async () => {
  //   const video = await adapter.fetchVideoInfo(videoId);
  //   expect(video).toBeInstanceOf(Video);
  // });

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
    apiGet.mockReset();
  });

  it.each(["https://youtube.com/watch?v=%s", "https://youtu.be/%s"].map(x => x.replace("%s", "BTZ5KVRUy1Q")))("Resolves single video URL: %s", async (link) => {
    apiGet.mockResolvedValue({ data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });

    const videos = await adapter.resolveURL(link);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toEqual({
      service: "youtube",
      id: "BTZ5KVRUy1Q",
      title: "tmpIwT4T4",
      description: "tmpIwT4T4",
      thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
      length: 10,
    });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it.each(["https://youtube.com/watch?v=%s&list=%p", "https://youtu.be/%s?list=%p"].map(x => x.replace("%s", "zgxj_0xPleg").replace("%p", "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")))("Resolves single video URL with playlist, with video in the playlist: %s", async (link) => {
    apiGet.mockReset();
    apiGet
      .mockResolvedValueOnce({ data: JSON.parse(youtubePlaylistItemsSampleResponses["PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm"]) });
    const fetchSpy = jest.spyOn(adapter, 'fetchVideoWithPlaylist');
    const fetchVideo = jest.spyOn(adapter, 'fetchVideoInfo');
    const fetchPlaylist = jest.spyOn(adapter, 'fetchPlaylistVideos');

    const videos = await adapter.resolveURL(link);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchPlaylist).toHaveBeenCalledTimes(1);
    expect(fetchVideo).toHaveBeenCalledTimes(0);
    expect(videos).toEqual([
      {
        service: "youtube",
        id: "zgxj_0xPleg",
        title: "Chris Chan: A Comprehensive History - Part 1",
        description: "(1982-2000)",
        thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
        // length expected to be undefined because the youtube api doesn't return video length in playlist items
        // feature requested here: https://issuetracker.google.com/issues/173420445
        highlight: true,
      },
      {
        service: "youtube",
        id: "_3QMqssyBwQ",
        title: "Chris Chan: A Comprehensive History - Part 2",
        description: "(2000-2004)",
        thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
      },
    ]);
    expect(apiGet).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
    fetchVideo.mockRestore();
    fetchPlaylist.mockRestore();
  });

  it.each(["https://youtube.com/watch?v=%s&list=%p", "https://youtu.be/%s?list=%p"].map(x => x.replace("%s", "BTZ5KVRUy1Q").replace("%p", "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")))("Resolves single video URL with playlist, with video NOT in the playlist: %s", async (link) => {
    apiGet.mockReset();
    apiGet
      .mockResolvedValueOnce({ data: JSON.parse(youtubePlaylistItemsSampleResponses["PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm"]) })
      .mockResolvedValueOnce({ data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
    const fetchSpy = jest.spyOn(adapter, 'fetchVideoWithPlaylist');
    const fetchVideo = jest.spyOn(adapter, 'fetchVideoInfo');
    const fetchPlaylist = jest.spyOn(adapter, 'fetchPlaylistVideos');

    const videos = await adapter.resolveURL(link);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchPlaylist).toHaveBeenCalledTimes(1);
    expect(fetchVideo).toHaveBeenCalledTimes(1);
    expect(videos).toEqual([
      {
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
        highlight: true,
      },
      {
        service: "youtube",
        id: "zgxj_0xPleg",
        title: "Chris Chan: A Comprehensive History - Part 1",
        description: "(1982-2000)",
        thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
        // length expected to be undefined because the youtube api doesn't return video length in playlist items
        // feature requested here: https://issuetracker.google.com/issues/173420445
      },
      {
        service: "youtube",
        id: "_3QMqssyBwQ",
        title: "Chris Chan: A Comprehensive History - Part 2",
        description: "(2000-2004)",
        thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
      },
    ]);
    expect(apiGet).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
    fetchVideo.mockRestore();
    fetchPlaylist.mockRestore();
  });

  it("Recovers after not being able to fetch playlist information for a video", async () => {
    apiGet
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce({ data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });

    const link = "https://youtube.com/watch?v=BTZ5KVRUy1Q&list=fakelistid";
    const videos = await adapter.resolveURL(link);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toEqual({
      service: "youtube",
      id: "BTZ5KVRUy1Q",
      title: "tmpIwT4T4",
      description: "tmpIwT4T4",
      thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
      length: 10,
    });
  });

  it.each(["LL", "WL"].map(p => `https://youtube.com/watch?v=BTZ5KVRUy1Q&list=${p}`))("Ignores the WL and LL private playlists", async (link) => {
    apiGet.mockResolvedValue({ data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
    const fetchVideoWithPlaylist = jest.spyOn(adapter, "fetchVideoWithPlaylist");
    const fetchVideo = jest.spyOn(adapter, "fetchVideoInfo");
    const videos: Video[] = await adapter.resolveURL(link);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toEqual({
      service: "youtube",
      id: "BTZ5KVRUy1Q",
      title: "tmpIwT4T4",
      description: "tmpIwT4T4",
      thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
      length: 10,
    });
    expect(fetchVideo).toBeCalledTimes(1);
    expect(fetchVideoWithPlaylist).not.toBeCalled();

    fetchVideoWithPlaylist.mockRestore();
    fetchVideo.mockRestore();
  });

  it("Resolves playlist", async () => {
    apiGet.mockReset();
    apiGet
      .mockResolvedValueOnce({ data: JSON.parse(youtubePlaylistItemsSampleResponses["PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm"]) });
    const fetchVideoWithPlaylist = jest.spyOn(adapter, 'fetchVideoWithPlaylist');
    const fetchVideo = jest.spyOn(adapter, 'fetchVideoInfo');
    const fetchPlaylist = jest.spyOn(adapter, 'fetchPlaylistVideos');

    const videos = await adapter.resolveURL("https://youtube.com/playlist?list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
    expect(fetchVideoWithPlaylist).toHaveBeenCalledTimes(0);
    expect(fetchPlaylist).toHaveBeenCalledTimes(1);
    expect(fetchVideo).toHaveBeenCalledTimes(0);
    expect(videos).toEqual([
      {
        service: "youtube",
        id: "zgxj_0xPleg",
        title: "Chris Chan: A Comprehensive History - Part 1",
        description: "(1982-2000)",
        thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
        // length expected to be null because the youtube api doesn't return video length in playlist items
        // feature requested here: https://issuetracker.google.com/issues/173420445
        length: null, // 2425,
      },
      {
        service: "youtube",
        id: "_3QMqssyBwQ",
        title: "Chris Chan: A Comprehensive History - Part 2",
        description: "(2000-2004)",
        thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
        length: null, //2403,
      },
    ]);
    expect(apiGet).toHaveBeenCalledTimes(1);

    fetchVideoWithPlaylist.mockRestore();
    fetchVideo.mockRestore();
    fetchPlaylist.mockRestore();
  });

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
  const adapter = new YouTubeAdapter("", redisClient);
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

describe("videoApiRequest", () => {
  const adapter = new YouTubeAdapter("", redisClient);
  const apiGet = jest.spyOn(adapter.api, "get");

  beforeEach(() => {
    apiGet.mockReset();
  });

  it("should use the fallback when out of quota, and onlyProperties contains length", async () => {
    apiGet.mockRejectedValue({ response: { status: 403 } });
    const fallbackSpy = jest.spyOn(adapter, 'getVideoLengthFallback').mockResolvedValue(10);
    const video = await adapter.videoApiRequest("BTZ5KVRUy1Q", ["length"]);
    expect(video).toEqual({
      "BTZ5KVRUy1Q": {
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        length: 10,
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg",
      },
    });
    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    fallbackSpy.mockClear();
  });

  it("should not use the fallback when out of quota, and onlyProperties does NOT contain length", async () => {
    apiGet.mockRejectedValue({ response: { status: 403 } });
    const fallbackSpy = jest.spyOn(adapter, 'getVideoLengthFallback').mockResolvedValue(10);
    expect(adapter.videoApiRequest("BTZ5KVRUy1Q", ["title"])).rejects.toThrow(new OutOfQuotaException("youtube"));
    expect(fallbackSpy).toHaveBeenCalledTimes(0);
  });

  it("should reject when the function fails for unknown reason", async () => {
    apiGet.mockRejectedValue(new Error("other error"));
    expect(adapter.videoApiRequest("BTZ5KVRUy1Q", ["title"])).rejects.toThrow(new Error("other error"));
  });
});
