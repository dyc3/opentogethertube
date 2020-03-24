const InfoExtract = require("../../../infoextract");
const storage = require("../../../storage");
const { CachedVideo } = require("../../../models");
const Video = require("../../../common/video.js");

const youtubeVideoListSampleResponses = {
  "BTZ5KVRUy1Q": '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/dqnBDym87ibK6816BZIGb9MCLYI\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/UyysisXjek5qf_mfkU7W8pFnmPs\\"","id": "BTZ5KVRUy1Q","snippet": {"publishedAt": "2019-08-26T11:32:44.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpIwT4T4","description": "tmpIwT4T4","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg","width": 320,"height": 180},"high": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpIwT4T4","description": "tmpIwT4T4"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": true,"projection": "rectangular"}}]}',
  "I3O9J02G67I": '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Ly8EM_vOONCLOEzI8TMYnzfG37k\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Xz7huLjXglgWYbMv-lMOshzynvk\\"","id": "I3O9J02G67I","snippet": {"publishedAt": "2019-07-26T13:02:54.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpATT2Cp","description": "tmpATT2Cp","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg","width": 120,"height": 90},"high": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpATT2Cp","description": "tmpATT2Cp"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": false,"projection": "rectangular"}}]}',
  "BTZ5KVRUy1Q,I3O9J02G67I": '{"kind": "youtube#videoListResponse","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/dqnBDym87ibK6816BZIGb9MCLYI\\"","pageInfo": {"totalResults": 2,"resultsPerPage": 2},"items": [{"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/UyysisXjek5qf_mfkU7W8pFnmPs\\"","id": "BTZ5KVRUy1Q","snippet": {"publishedAt": "2019-08-26T11:32:44.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpIwT4T4","description": "tmpIwT4T4","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg","width": 320,"height": 180},"high": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/BTZ5KVRUy1Q/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpIwT4T4","description": "tmpIwT4T4"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": true,"projection": "rectangular"}}, {"kind": "youtube#video","etag": "\\"j6xRRd8dTPVVptg711_CSPADRfg/Xz7huLjXglgWYbMv-lMOshzynvk\\"","id": "I3O9J02G67I","snippet": {"publishedAt": "2019-07-26T13:02:54.000Z","channelId": "UCsLiV4WJfkTEHH0b9PmRklw","title": "tmpATT2Cp","description": "tmpATT2Cp","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg","width": 120,"height": 90},"high": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/hqdefault.jpg","width": 480,"height": 360},"standard": {"url": "https://i.ytimg.com/vi/I3O9J02G67I/sddefault.jpg","width": 640,"height": 480}},"channelTitle": "Webdriver Torso","categoryId": "22","liveBroadcastContent": "none","localized": {"title": "tmpATT2Cp","description": "tmpATT2Cp"}},"contentDetails": {"duration": "PT10S","dimension": "2d","definition": "sd","caption": "false","licensedContent": false,"projection": "rectangular"}}]}',
};

const youtubePlaylistItemsSampleResponses = {
  "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm": '{"kind": "youtube#playlistItemListResponse","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/cnSEbcCodxUd20zl5d_GdkwUYHA\\"","nextPageToken": "CAIQAA","pageInfo": {"totalResults": 30,"resultsPerPage": 2},"items": [{"kind": "youtube#playlistItem","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/NuyI91BSe5o9qLD3tvex5k06aRA\\"","id": "UExBQnFFWXE2SDN2cENtc215VW5IbmZNT2VBbmpCZFNObS4wMTcyMDhGQUE4NTIzM0Y5","snippet": {"publishedAt": "2019-03-10T02:57:27.000Z","channelId": "UC_3pplzbKMZsP5zBH_6SVJQ","title": "Chris Chan: A Comprehensive History - Part 1","description": "(1982-2000)","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/zgxj_0xPleg/default.jpg","width": 120,"height": 90},"medium": {"url": "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg","width": 320,"height": 180}},"channelTitle": "GenoSamuel2.1","playlistId": "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm","position": 0,"resourceId": {"kind": "youtube#video","videoId": "zgxj_0xPleg"}}}, {"kind": "youtube#playlistItem","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/yhZlmlB3rT2tcC0HpcPP0XuiTpc\\"","id": "UExBQnFFWXE2SDN2cENtc215VW5IbmZNT2VBbmpCZFNObS41NkI0NEY2RDEwNTU3Q0M2","snippet": {"publishedAt": "2019-03-02T15:25:25.000Z","channelId": "UC_3pplzbKMZsP5zBH_6SVJQ","title": "Chris Chan: A Comprehensive History - Part 2","description": "(2000-2004)","thumbnails": {"default": {"url": "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg","width": 120,"height": 90}},"channelTitle": "GenoSamuel2.1","playlistId": "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm","position": 1,"resourceId": {"kind": "youtube#video","videoId": "_3QMqssyBwQ"}}}]}',
};

const youtubeChannelInfoSampleResponses = {
  "UC_3pplzbKMZsP5zBH_6SVJQ": '{"kind": "youtube#channelListResponse","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/leWpA6dGmEXalohSiXBor2qtaWQ\\"","pageInfo": {"totalResults": 1,"resultsPerPage": 1},"items": [{"kind": "youtube#channel","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/PB1IXNZVuqTG-acrVEyYgyg_L7s\\"","id": "UC_3pplzbKMZsP5zBH_6SVJQ","contentDetails": {"relatedPlaylists": {"uploads": "UU_3pplzbKMZsP5zBH_6SVJQ","watchHistory": "HL","watchLater": "WL"}}}]}',
};

const youtubeSearchSampleResponses = {
  "family guy funny moments": '{ "kind": "youtube#searchListResponse", "etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/-rW-pTc9pdX9oaCnXbRwseTrCG4\\"", "nextPageToken": "CAMQAA", "regionCode": "US", "pageInfo": {"totalResults": 1000000,"resultsPerPage": 3 }, "items": [{"kind": "youtube#searchResult","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/H2q6SSWvRq7umOC6k4pKLlQ_EFU\\"","id": {"kind": "youtube#video","videoId": "UJXZihZCP2g"}},{"kind": "youtube#searchResult","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/qmodXyyqsd1jYzoKX0Sg658bGbY\\"","id": {"kind": "youtube#video","videoId": "ysEdZ3KWYIU"}},{"kind": "youtube#searchResult","etag": "\\"SJZWTG6xR0eGuCOh2bX6w3s4F94/yebpBNSyYMGWyXGEruVYdK1PmcA\\"","id": {"kind": "youtube#video","videoId": "Tu3TiESKJGk"}} ]}',
};

const vimeoOEmbedSampleResponses = {
  "94338566": `{"type":"video","version":"1.0","provider_name":"Vimeo","provider_url":"https://vimeo.com/","title":"Showreel","author_name":"Susi Sie","author_url":"https://vimeo.com/susisie","is_plus":"1","account_type":"plus","width":480,"height":190,"duration":70,"description":"No animation. No 3D. Just reality.","thumbnail_url":"https://i.vimeocdn.com/video/474246782_295x166.jpg","thumbnail_width":295,"thumbnail_height":117,"thumbnail_url_with_play_button":"https://i.vimeocdn.com/filter/overlay?src0=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F474246782_295x166.jpg&src1=http%3A%2F%2Ff.vimeocdn.com%2Fp%2Fimages%2Fcrawler_play.png","upload_date":"2014-05-07 04:30:13","video_id":94338566,"uri":"/videos/94338566"}`,
};

const dailymotionVideoInfoSampleResponses = {
  "x1fz4ii": `{"title":"Hackathon BeMyApp/Dailymotion","description":"This is a video that was done after our hackathon","thumbnail_url":"https://s2.dmcdn.net/v/7sRg71UN0OKwaG4Wj","duration":213}`,
};

describe('InfoExtractor Link Parsing', () => {
  it('getService() should return youtube when given youtube link', () => {
    expect(InfoExtract.getService("http://youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("http://www.youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://www.youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://m.youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("http://youtu.be/I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://youtu.be/I3O9J02G67I")).toEqual("youtube");
  });

  it('getService() should return vimeo when given vimeo link', () => {
    expect(InfoExtract.getService("https://vimeo.com/94338566")).toEqual("vimeo");
  });

  it('getService() should return dailymotion when given dailymotion link', () => {
    expect(InfoExtract.getService("https://www.dailymotion.com/video/x6hkywd")).toEqual("dailymotion");
    expect(InfoExtract.getService("https://dai.ly/x6hkywd")).toEqual("dailymotion");
  });

  it('getService() should return googledrive when given google drive link', () => {
    expect(InfoExtract.getService("https://drive.google.com/file/d/1KxVGtZ2W8sAq9r3xx0t8TLkjq96Np9aw/view?usp=sharing")).toEqual("googledrive");
    expect(InfoExtract.getService("https://drive.google.com/file/d/1KII8vJ80JCTJxKVnwFqtEAU85pjcSKzq/view")).toEqual("googledrive");
    expect(InfoExtract.getService("https://drive.google.com/open?id=1rx4j-79UXk0PXccDwTxnrVVMenGopDIN")).toEqual("googledrive");
  });

  it('getService() should return false when given link to unsupported service', () => {
    expect(InfoExtract.getService("http://example.com")).toEqual(false);
  });

  it('getService() should return false when given invalid string', () => {
    expect(InfoExtract.getService("funny man")).toEqual(false);
    expect(InfoExtract.getService("youtube.com epic fail compilation")).toEqual(false);
    expect(InfoExtract.getService("")).toEqual(false);
  });

  it('getService() should return false when given null', () => {
    expect(InfoExtract.getService(null)).toEqual(false);
  });

  it('getService() should return false when given undefined', () => {
    expect(InfoExtract.getService(undefined)).toEqual(false);
  });

  it('getVideoIdYoutube() should return correct id when given youtube link', () => {
    expect(InfoExtract.getVideoIdYoutube("http://youtube.com/watch?v=I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("http://www.youtube.com/watch?v=I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("https://youtube.com/watch?v=I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("https://www.youtube.com/watch?v=I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("https://m.youtube.com/watch?v=I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("http://youtu.be/I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("https://youtu.be/I3O9J02G67I")).toEqual("I3O9J02G67I");
    expect(InfoExtract.getVideoIdYoutube("https://youtu.be/I3O9J02G67I?t=2")).toEqual("I3O9J02G67I");
  });

  it('getVideoIdYoutube() should return null if link does not contain video id', () => {
    expect(InfoExtract.getVideoIdYoutube("http://youtube.com/")).toEqual(null);
    expect(InfoExtract.getVideoIdYoutube("https://www.youtube.com/playlist?list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")).toEqual(null);
  });

  it('getVideoIdVimeo() should return correct id when given vimeo link', () => {
    expect(InfoExtract.getVideoIdVimeo("https://vimeo.com/94338566")).toEqual("94338566");
    expect(InfoExtract.getVideoIdVimeo("https://vimeo.com/94338566?t=2")).toEqual("94338566");
    expect(InfoExtract.getVideoIdVimeo("https://vimeo.com/channels/susisie/94338566")).toEqual("94338566");
  });

  it('getVideoIdDailymotion() should return correct id when given dailymotion link', () => {
    expect(InfoExtract.getVideoIdDailymotion("https://www.dailymotion.com/video/x6hkywd")).toEqual("x6hkywd");
    expect(InfoExtract.getVideoIdDailymotion("https://www.dailymotion.com/video/x6hkywd?start=120")).toEqual("x6hkywd");
    expect(InfoExtract.getVideoIdDailymotion("https://dai.ly/x6hkywd")).toEqual("x6hkywd");
  });

  it('getVideoIdGoogleDrive() should return correct id when given google drive link', () => {
    expect(InfoExtract.getVideoIdGoogleDrive("https://drive.google.com/file/d/1KxVGtZ2W8sAq9r3xx0t8TLkjq96Np9aw/view?usp=sharing")).toEqual("1KxVGtZ2W8sAq9r3xx0t8TLkjq96Np9aw");
    expect(InfoExtract.getVideoIdGoogleDrive("https://drive.google.com/file/d/1KII8vJ80JCTJxKVnwFqtEAU85pjcSKzq/view")).toEqual("1KII8vJ80JCTJxKVnwFqtEAU85pjcSKzq");
    expect(InfoExtract.getVideoIdGoogleDrive("https://drive.google.com/open?id=1rx4j-79UXk0PXccDwTxnrVVMenGopDIN")).toEqual("1rx4j-79UXk0PXccDwTxnrVVMenGopDIN");
  });
});

describe('InfoExtractor Bulk Retrieval', () => {
  beforeEach(async () => {
    await CachedVideo.destroy({ where: {} });
  }),

  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  }),

  it("should get the correct video metadata for multiple videos with only one call to the youtube API", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q,I3O9J02G67I"]) })));
    let videos = [
      {
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      },
      {
        service: "youtube",
        id: "I3O9J02G67I",
      },
    ];

    InfoExtract.getManyVideoInfo(videos).then(videos => {
      expect(videos).toHaveLength(2);
      expect(videos[0]).toEqual({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      });
      expect(videos[1]).toEqual({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg",
        length: 10,
      });
      expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(1);
      done();
    }).catch(err => done.fail(err));
  });

  it("should get the correct video metadata for multiple videos with only 2 calls to the youtube API", done => {
    InfoExtract.YtApi.get = jest.fn().mockImplementation(url => {
      if (url.includes("BTZ5KVRUy1Q")) {
        return new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) }));
      }
      else if (url.includes("I3O9J02G67I")) {
        return new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["I3O9J02G67I"]) }));
      }
    });
    let videos = [
      {
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
      },
      {
        service: "youtube",
        id: "I3O9J02G67I",
        length: 10,
      },
    ];

    InfoExtract.getManyVideoInfo(videos).then(videos => {
      expect(videos).toHaveLength(2);
      expect(videos[0]).toEqual({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      });
      expect(videos[1]).toEqual({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg",
        length: 10,
      });
      expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(2);
      done();
    }).catch(err => done.fail(err));
  });
});

describe("InfoExtractor Youtube Support", () => {
  it("should get 1 video", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"]).then(results => {
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it("should get 1 video with onlyProperties set", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    // eslint-disable-next-line array-bracket-newline
    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], ["title", "description", "thumbnail", "length"]).then(results => {
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it("should get 2 videos", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q,I3O9J02G67I"]) })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    // eslint-disable-next-line array-bracket-newline
    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q", "I3O9J02G67I"]).then(results => {
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }));
      expect(results["I3O9J02G67I"]).toEqual(new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg",
        length: 10,
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it("should attempt fallback if it fails to get video due to quota limit, and length is requested", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(Promise.reject({ response: { status: 403 } }));
    let getLengthFallback = jest.spyOn(InfoExtract, "getVideoLengthYoutube_Fallback").mockReturnValue(Promise.resolve(10));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(Promise.resolve(true));

    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], ["length"]).then(results => {
      expect(getLengthFallback).toHaveBeenCalled();
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        length: 10,
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg",
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalled();
      getLengthFallback.mockRestore();
      done();
    }).catch(err => {
      getLengthFallback.mockRestore();
      done.fail(err);
    });
  });

  it("should fail to get video due to quota limit, and length is not requested", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(Promise.reject({ response: { status: 403 } }));
    let getLengthFallback = jest.spyOn(InfoExtract, "getVideoLengthYoutube_Fallback").mockReturnValue(Promise.resolve(10));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(Promise.resolve(true));

    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], ["title"]).then(() => {
      getLengthFallback.mockRestore();
      done.fail();
    }).catch(err => {
      expect(getLengthFallback).not.toHaveBeenCalled();
      expect(err.name).toBe("OutOfQuotaException");
      expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();
      getLengthFallback.mockRestore();
      done();
    });
  });

  it("should fail to get video due to other reasons", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 500 } })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"]).then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).not.toBe("OutOfQuotaException");
      expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });

  it("should fail to get video because ids is not an array", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getVideoInfoYoutube("BTZ5KVRUy1Q").then(() => {
      done.fail();
    }).catch(() => {
      expect(InfoExtract.YtApi.get).not.toHaveBeenCalled();
      expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });

  it("should fail to get video because onlyProperties is an empty array", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], []).then(() => {
      done.fail();
    }).catch(() => {
      expect(InfoExtract.YtApi.get).not.toHaveBeenCalled();
      expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });

  it("should get videos in the given youtube playlist", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubePlaylistItemsSampleResponses["PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm"]) })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getPlaylistYoutube("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm").then(results => {
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(new Video({
        service: "youtube",
        id: "zgxj_0xPleg",
        title: "Chris Chan: A Comprehensive History - Part 1",
        description: "(1982-2000)",
        thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
      }));
      expect(results[1]).toEqual(new Video({
        service: "youtube",
        id: "_3QMqssyBwQ",
        title: "Chris Chan: A Comprehensive History - Part 2",
        description: "(2000-2004)",
        thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);
      done();
    }).catch(err => done.fail(err));
  });

  it("should fail when youtube playlist request fails due to quota limit", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 403 } })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getPlaylistYoutube("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm").then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).toBe("OutOfQuotaException");
      expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });

  it("should fail when youtube playlist request fails due to other reasons", done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 500 } })));
    storage.updateManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(true)));

    InfoExtract.getPlaylistYoutube("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm").then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).not.toBe("OutOfQuotaException");
      expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });

  it("should get videos on the given youtube channel", done => {
    let redisClientMock = {
      get: jest.fn().mockImplementation((key, callback) => callback(null, null)),
      set: jest.fn(),
    };
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeChannelInfoSampleResponses["UC_3pplzbKMZsP5zBH_6SVJQ"]) })));
    InfoExtract.getPlaylistYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.init(redisClientMock);
    InfoExtract.getChanneInfoYoutube({ channel: "UC_3pplzbKMZsP5zBH_6SVJQ" }).then(results => {
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }));
      expect(results[1]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }));
      done();
    }).catch(err => done.fail(err));
  });

  it("should fail when youtube channel request fails due to quota limit", done => {
    let redisClientMock = {
      get: jest.fn().mockImplementation((key, callback) => callback(null, null)),
      set: jest.fn(),
    };
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 403 } })));
    InfoExtract.init(redisClientMock);
    InfoExtract.getChanneInfoYoutube({ channel: "UC_3pplzbKMZsP5zBH_6SVJQ" }).then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).toBe("OutOfQuotaException");
      done();
    });
  });

  it("should fail when youtube channel request fails for other reasons", done => {
    let redisClientMock = {
      get: jest.fn().mockImplementation((key, callback) => callback(null, null)),
      set: jest.fn(),
    };
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 500 } })));
    InfoExtract.init(redisClientMock);
    InfoExtract.getChanneInfoYoutube({ channel: "UC_3pplzbKMZsP5zBH_6SVJQ" }).then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).not.toBe("OutOfQuotaException");
      done();
    });
  });

  it("should search youtube and parse results without failing", done => {
    let redisClientMock = {
      get: jest.fn().mockImplementation((key, callback) => callback(null, null)),
      set: jest.fn(),
    };
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeSearchSampleResponses["family guy funny moments"]) })));
    InfoExtract.init(redisClientMock);
    InfoExtract.searchYoutube("family guy funny moments").then(results => {
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(new Video({
        service: "youtube",
        id: "UJXZihZCP2g",
      }));
      expect(results[1]).toEqual(new Video({
        service: "youtube",
        id: "ysEdZ3KWYIU",
      }));
      expect(results[2]).toEqual(new Video({
        service: "youtube",
        id: "Tu3TiESKJGk",
      }));
      expect(redisClientMock.set).toBeCalled();
      done();
    }).catch(err => done.fail(err));
  });

  it("should search youtube using the extra options", done => {
    let redisClientMock = {
      get: jest.fn().mockImplementation((key, callback) => callback(null, null)),
      set: jest.fn(),
    };
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeSearchSampleResponses["family guy funny moments"]) })));
    InfoExtract.init(redisClientMock);
    InfoExtract.searchYoutube("family guy funny moments", { maxResults: 3, fromUser: "test" }).then(() => {
      expect(InfoExtract.YtApi.get).toBeCalled();
      expect(InfoExtract.YtApi.get.mock.calls[0][0]).toContain("maxResults=3");
      expect(InfoExtract.YtApi.get.mock.calls[0][0]).toContain("quotaUser=test");
      done();
    }).catch(err => done.fail(err));
  });
});

describe("InfoExtractor Vimeo Support", () => {
  it("should handle single video", done => {
    InfoExtract.VimeoApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(vimeoOEmbedSampleResponses["94338566"]) })));
    storage.updateVideoInfo = jest.fn();

    InfoExtract.getVideoInfoVimeo("94338566").then(video => {
      expect(video).toEqual(new Video({
        service: "vimeo",
        id: "94338566",
        title: "Showreel",
        description: "No animation. No 3D. Just reality.",
        thumbnail: "https://i.vimeocdn.com/video/474246782_295x166.jpg",
        length: 70,
      }));
      expect(storage.updateVideoInfo).toHaveBeenCalledTimes(1);
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it("should handle video with embedding disabled gracefully", done => {
    InfoExtract.VimeoApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 403 } })));
    storage.updateVideoInfo = jest.fn();
    InfoExtract.getVideoInfoVimeo("94338566").then(video => {
      expect(video).toBeNull();
      expect(storage.updateVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });

  it("should handle other failures gracefully", done => {
    InfoExtract.VimeoApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 200 } })));
    storage.updateVideoInfo = jest.fn();
    InfoExtract.getVideoInfoVimeo("94338566").then(video => {
      expect(video).toEqual(new Video({
        service: "vimeo",
        id: "94338566",
      }));
      expect(storage.updateVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });
});

describe("InfoExtractor Dailymotion Support", () => {
  it("should handle single video", done => {
    InfoExtract.DailymotionApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(dailymotionVideoInfoSampleResponses["x1fz4ii"]) })));
    storage.updateVideoInfo = jest.fn();

    InfoExtract.getVideoInfoDailymotion("x1fz4ii").then(video => {
      expect(video).toEqual(new Video({
        service: "dailymotion",
        id: "x1fz4ii",
        title: "Hackathon BeMyApp/Dailymotion",
        description: "This is a video that was done after our hackathon",
        thumbnail: "https://s2.dmcdn.net/v/7sRg71UN0OKwaG4Wj",
        length: 213,
      }));
      expect(storage.updateVideoInfo).toHaveBeenCalledTimes(1);
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it("should handle other failures gracefully", done => {
    InfoExtract.DailymotionApi.get = jest.fn().mockReturnValue(new Promise((resolve, reject) => reject({ response: { status: 500 } })));
    storage.updateVideoInfo = jest.fn();
    InfoExtract.getVideoInfoDailymotion("x1fz4ii").then(video => {
      expect(video).toBeNull();
      expect(storage.updateVideoInfo).not.toHaveBeenCalled();
      done();
    });
  });
});

describe("InfoExtractor Google Drive Support", () => {
  it("should return whether or not the mime type is supported", () => {
    expect(InfoExtract.isSupportedMimeType("video/mp4")).toBe(true);
    expect(InfoExtract.isSupportedMimeType("video/webm")).toBe(true);
    expect(InfoExtract.isSupportedMimeType("video/x-flv")).toBe(false);
    expect(InfoExtract.isSupportedMimeType("video/x-matroska")).toBe(false);
  });

  it("should return the folder id if the link is valid", () => {
    expect(InfoExtract.getFolderIdGoogleDrive("https://drive.google.com/drive/u/0/folders/0B3OoGtYynRDNM1hNZmJ5Unh0Qjg")).toBe("0B3OoGtYynRDNM1hNZmJ5Unh0Qjg");
    expect(InfoExtract.getFolderIdGoogleDrive("https://drive.google.com/drive/folders/0B3OoGtYynRDNM1hNZmJ5Unh0Qjg")).toBe("0B3OoGtYynRDNM1hNZmJ5Unh0Qjg");
  });
});

describe('InfoExtractor Caching Spec', () => {
  beforeEach(async () => {
    console.warn("CLEAR CACHE");
    await CachedVideo.destroy({ where: {} });
  }),

  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  }),

  it('should get the correct video metadata', done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) })));

    InfoExtract.getVideoInfo("youtube", "BTZ5KVRUy1Q").then(video => {
      expect(video).toBeDefined();
      expect(video.service).toBeDefined();
      expect(video.service).toBe("youtube");
      expect(video.serviceId).toBeUndefined();
      expect(video.id).toBeDefined();
      expect(video.id).toBe("BTZ5KVRUy1Q");
      expect(video.title).toBeDefined();
      expect(video.title).toBe("tmpIwT4T4");
      expect(video.description).toBeDefined();
      expect(video.description).toBe("tmpIwT4T4");
      expect(video.thumbnail).toBeDefined();
      expect(video.thumbnail).toBe("https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg");
      expect(video.length).toBeDefined();
      expect(video.length).toBe(10);
      done();
    }).catch(err => done.fail(err));
  });

  it('should miss cache, get the correct video metadata, and store it in the cache', async done => {
    InfoExtract.YtApi.get = jest.fn().mockReturnValue(new Promise(resolve => resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["I3O9J02G67I"]) })));

    await expect(CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).resolves.toBeNull();

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(async video => {
      expect(video).toBeDefined();
      expect(video.service).toBeDefined();
      expect(video.service).toBe("youtube");
      expect(video.serviceId).toBeUndefined();
      expect(video.id).toBeDefined();
      expect(video.id).toBe("I3O9J02G67I");
      expect(video.title).toBeDefined();
      expect(video.title).toBe("tmpATT2Cp");
      expect(video.description).toBeDefined();
      expect(video.description).toBe("tmpATT2Cp");
      expect(video.thumbnail).toBeDefined();
      expect(video.thumbnail).toBe("https://i.ytimg.com/vi/I3O9J02G67I/default.jpg");
      expect(video.length).toBeDefined();
      expect(video.length).toBe(10);

      await expect(CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).resolves.toBeDefined();

      expect(InfoExtract.YtApi.get).toBeCalled();
      done();
    }).catch(err => done.fail(err));
  });

  it('should hit cache, get the correct video metadata from the cache', async done => {
    await expect(CachedVideo.count()).resolves.toEqual(0);

    await expect(CachedVideo.create({
      service: "fakeservice",
      serviceId: "abc123",
      title: "Test Title",
      description: "This is a test description.",
      thumbnail: "http://example.com/thumbnail.jpg",
      length: 32,
    })).resolves.toBeDefined();

    await expect(CachedVideo.count()).resolves.toEqual(1);

    InfoExtract.getVideoInfo("fakeservice", "abc123").then(async video => {
      expect(video).toBeDefined();
      expect(video.service).toBeDefined();
      expect(video.service).toBe("fakeservice");
      expect(video.serviceId).toBeUndefined();
      expect(video.id).toBeDefined();
      expect(video.id).toBe("abc123");
      expect(video.title).toBeDefined();
      expect(video.title).toBe("Test Title");
      expect(video.description).toBeDefined();
      expect(video.description).toBe("This is a test description.");
      expect(video.thumbnail).toBeDefined();
      expect(video.thumbnail).toBe("http://example.com/thumbnail.jpg");
      expect(video.length).toBeDefined();
      expect(video.length).toBe(32);

      await expect(CachedVideo.count()).resolves.toEqual(1);
      await expect(CachedVideo.findOne({ where: { service: "fakeservice", serviceId: "abc123" }})).resolves.toBeDefined();
      done();
    }).catch(err => done.fail(err));
  });

  it('should partially hit cache, get the missing video metadata (length), and store it in the cache', async done => {
    InfoExtract.getVideoInfoYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", length: 10 } })));

    await expect(CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).resolves.toBeNull();

    await expect(CachedVideo.create({
      service: "youtube",
      serviceId: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
    })).resolves.toBeDefined();

    await CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }}).then(result => {
      expect(result).toBeDefined();
      expect(result.length).toBeNull();
    });

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(async video => {
      expect(InfoExtract.getVideoInfoYoutube).toBeCalledWith(["I3O9J02G67I"], ["length"]);

      expect(video).toBeDefined();
      expect(video.service).toBeDefined();
      expect(video.service).toBe("youtube");
      expect(video.serviceId).toBeUndefined();
      expect(video.id).toBeDefined();
      expect(video.id).toBe("I3O9J02G67I");
      expect(video.title).toBeDefined();
      expect(video.title).toBe("tmpATT2Cp");
      expect(video.description).toBeDefined();
      expect(video.description).toBe("tmpATT2Cp");
      expect(video.thumbnail).toBeDefined();
      expect(video.thumbnail).toBe("https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg");
      expect(video.length).toBeDefined();
      expect(video.length).toBe(10);

      await expect(CachedVideo.count()).resolves.toEqual(1);
      await expect(CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).resolves.toBeDefined();
      done();
    }).catch(err => done.fail(err));
  });
});

describe('InfoExtractor Partial Data Retrieval', () => {
  it('should detect if length is missing from the cached video info', done => {
    storage.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({
      "service": "youtube",
      "id": "I3O9J02G67I",
      "title": "tmpATT2Cp",
      "description": "tmpATT2Cp",
      "thumbnail": "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
    })));
    InfoExtract.getVideoInfoYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", length: 10 } })));

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(video => {
      expect(InfoExtract.getVideoInfoYoutube).toBeCalledWith(["I3O9J02G67I"], ["length"]);
      expect(video).toBeDefined();
      done();
    });
  });

  it('should detect if title is missing from the cached video info', done => {
    storage.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({
      "service": "youtube",
      "id": "I3O9J02G67I",
      "description": "tmpATT2Cp",
      "thumbnail": "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      "length": 10,
    })));
    InfoExtract.getVideoInfoYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", title: "tmpATT2Cp" } })));

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(video => {
      expect(InfoExtract.getVideoInfoYoutube).toBeCalledWith(["I3O9J02G67I"], ["title"]);
      expect(video).toBeDefined();
      done();
    });
  });

  it('should detect if title and description is missing from the cached video info', done => {
    storage.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({
      "service": "youtube",
      "id": "I3O9J02G67I",
      "thumbnail": "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      "length": 10,
    })));
    InfoExtract.getVideoInfoYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", title: "tmpATT2Cp", description: "tmpATT2Cp" } })));

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(video => {
      expect(InfoExtract.getVideoInfoYoutube).toBeCalledWith(["I3O9J02G67I"], [
        "title",
        "description",
      ]);
      expect(video).toBeDefined();
      done();
    });
  });
});

describe('InfoExtractor Add Preview Spec', () => {
  it('should return 1 video when given a long youtube URL', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }))));

    InfoExtract.getAddPreview("https://www.youtube.com/watch?v=I3O9J02G67I").then(result => {
      expect(InfoExtract.getVideoInfo).toBeCalled();
      expect(result).toHaveLength(1);

      done();
    });
  });

  it('should return 1 video when given a short youtube URL', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }))));

    InfoExtract.getAddPreview("https://youtu.be/I3O9J02G67I").then(result => {
      expect(InfoExtract.getVideoInfo).toBeCalled();
      expect(result).toHaveLength(1);

      done();
    });
  });

  it('should return at least 1 video when given a public youtube playlist', done => {
    InfoExtract.getPlaylistYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ])));

    InfoExtract.getAddPreview("https://youtube.com/playlist?list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm").then(result => {
      expect(InfoExtract.getPlaylistYoutube).toBeCalled();
      expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('title', "tmpATT2Cp");
      expect(result[0]).toHaveProperty('length', 10);
      expect(result[1]).toHaveProperty('title', "tmpIwT4T4");
      expect(result[1]).toHaveProperty('length', 10);

      done();
    });
  });

  it('should return at least 1 video when given a youtube video that is in a public playlist', done => {
    InfoExtract.getPlaylistYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ])));

    InfoExtract.getAddPreview("https://youtube.com/watch?v=I3O9J02G67I&list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm&index=1").then(result => {
      expect(InfoExtract.getPlaylistYoutube).toBeCalled();
      expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('title', "tmpATT2Cp");
      expect(result[0]).toHaveProperty('length', 10);
      expect(result[1]).toHaveProperty('title', "tmpIwT4T4");
      expect(result[1]).toHaveProperty('length', 10);

      done();
    });
  });

  it('should highlight the video when given a youtube video that is in a public playlist', done => {
    InfoExtract.getPlaylistYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ])));

    InfoExtract.getAddPreview("https://youtube.com/watch?v=I3O9J02G67I&list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm&index=1").then(result => {
      expect(InfoExtract.getPlaylistYoutube).toBeCalled();
      expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', "I3O9J02G67I");
      expect(result[0]).toHaveProperty('highlight', true);

      done();
    });
  });

  it('should return at 1 video when given a youtube video that is in a private playlist', done => {
    InfoExtract.getPlaylistYoutube = jest.fn().mockReturnValue(new Promise(() => {
      throw new Error("fake error");
    }));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([])));
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }))));

    InfoExtract.getAddPreview("https://youtube.com/watch?v=I3O9J02G67I&list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm&index=1").then(result => {
      expect(InfoExtract.getPlaylistYoutube).toBeCalled();
      expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
      expect(InfoExtract.getManyVideoInfo).not.toBeCalled();
      expect(InfoExtract.getVideoInfo).toBeCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('title', "tmpATT2Cp");
      expect(result[0]).toHaveProperty('length', 10);

      done();
    });
  });

  it('should return at least 1 video when given a youtube channel url', done => {
    InfoExtract.getChanneInfoYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ])));

    InfoExtract.getAddPreview("https://www.youtube.com/channel/UC_3pplzbKMZsP5zBH_6SVJQ").then(result => {
      expect(InfoExtract.getChanneInfoYoutube).toBeCalled();
      expect(InfoExtract.getChanneInfoYoutube).toBeCalledWith({ channel: "UC_3pplzbKMZsP5zBH_6SVJQ" });
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);

      done();
    });
  });

  it('should return at least 1 video when given a custom youtube channel url', done => {
    InfoExtract.getChanneInfoYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ])));

    InfoExtract.getAddPreview("https://www.youtube.com/user/GenoSamuel1994Part2").then(result => {
      expect(InfoExtract.getChanneInfoYoutube).toBeCalled();
      expect(InfoExtract.getChanneInfoYoutube).toBeCalledWith({ user: "GenoSamuel1994Part2" });
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);

      done();
    });
  });

  it('should search youtube and return at least 1 video when given a non url input', done => {
    InfoExtract.searchYoutube = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ])));
    InfoExtract.getManyVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ])));
    process.env.ENABLE_YOUTUBE_SEARCH = true;

    InfoExtract.getAddPreview("blah blah").then(result => {
      expect(InfoExtract.searchYoutube).toBeCalledWith("blah blah", {});
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);

      process.env.ENABLE_YOUTUBE_SEARCH = false;
      done();
    });
  });

  it('should return 1 video when given a vimeo URL', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve(new Video({
      service: "vimeo",
      id: "94338566",
      title: "Showreel",
      description: "No animation. No 3D. Just reality.",
      thumbnail: "https://i.vimeocdn.com/video/474246782_295x166.jpg",
      length: 70,
    }))));

    InfoExtract.getAddPreview("https://vimeo.com/videos/94338566").then(result => {
      expect(InfoExtract.getVideoInfo).toBeCalled();
      expect(result).toHaveLength(1);

      done();
    });
  });
});
