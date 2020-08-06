const _ = require("lodash");
const InfoExtract = require("../../../infoextract");
jest.spyOn(InfoExtract.redisClient, 'get').mockImplementation((key, callback) => callback(null, null));
jest.spyOn(InfoExtract.redisClient, 'set').mockImplementation();
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

const directVideoInfoFFProbe = {
  "normal-mp4": `{
    "streams": [
        {
            "index": 0,
            "codec_name": "aac",
            "codec_long_name": "AAC (Advanced Audio Coding)",
            "profile": "LC",
            "codec_type": "audio",
            "codec_time_base": "1/48000",
            "codec_tag_string": "mp4a",
            "codec_tag": "0x6134706d",
            "sample_fmt": "fltp",
            "sample_rate": "48000",
            "channels": 2,
            "channel_layout": "stereo",
            "bits_per_sample": 0,
            "r_frame_rate": "0/0",
            "avg_frame_rate": "0/0",
            "time_base": "1/48000",
            "start_pts": 0,
            "start_time": "0.000000",
            "duration_ts": 4883456,
            "duration": "101.738667",
            "bit_rate": "9429",
            "max_bit_rate": "128000",
            "nb_frames": "4769",
            "disposition": {
                "default": 1,
                "dub": 0,
                "original": 0,
                "comment": 0,
                "lyrics": 0,
                "karaoke": 0,
                "forced": 0,
                "hearing_impaired": 0,
                "visual_impaired": 0,
                "clean_effects": 0,
                "attached_pic": 0,
                "timed_thumbnails": 0
            },
            "tags": {
                "creation_time": "2018-06-14T00:55:14.000000Z",
                "language": "eng",
                "handler_name": "Sound Media Handler"
            }
        },
        {
            "index": 1,
            "codec_name": "h264",
            "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
            "profile": "High",
            "codec_type": "video",
            "codec_time_base": "50867/3052000",
            "codec_tag_string": "avc1",
            "codec_tag": "0x31637661",
            "width": 1280,
            "height": 720,
            "coded_width": 1280,
            "coded_height": 720,
            "has_b_frames": 2,
            "sample_aspect_ratio": "0:1",
            "display_aspect_ratio": "0:1",
            "pix_fmt": "yuv420p",
            "level": 32,
            "color_range": "tv",
            "color_space": "bt709",
            "color_transfer": "iec61966-2-1",
            "color_primaries": "bt709",
            "chroma_location": "left",
            "refs": 1,
            "is_avc": "true",
            "nal_length_size": "4",
            "r_frame_rate": "30/1",
            "avg_frame_rate": "1526000/50867",
            "time_base": "1/1000",
            "start_pts": 67,
            "start_time": "0.067000",
            "duration_ts": 101734,
            "duration": "101.734000",
            "bit_rate": "20006455",
            "bits_per_raw_sample": "8",
            "nb_frames": "3052",
            "disposition": {
                "default": 1,
                "dub": 0,
                "original": 0,
                "comment": 0,
                "lyrics": 0,
                "karaoke": 0,
                "forced": 0,
                "hearing_impaired": 0,
                "visual_impaired": 0,
                "clean_effects": 0,
                "attached_pic": 0,
                "timed_thumbnails": 0
            },
            "tags": {
                "creation_time": "2018-06-14T00:55:14.000000Z",
                "language": "und",
                "handler_name": "Video Media Handler",
                "encoder": "AVC Coding"
            }
        }
    ]
}`,
  "mp4-no-audio": `{
    "streams": [
        {
            "index": 0,
            "codec_name": "h264",
            "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
            "profile": "High",
            "codec_type": "video",
            "codec_time_base": "1/60",
            "codec_tag_string": "avc1",
            "codec_tag": "0x31637661",
            "width": 1024,
            "height": 576,
            "coded_width": 1024,
            "coded_height": 576,
            "has_b_frames": 2,
            "sample_aspect_ratio": "0:1",
            "display_aspect_ratio": "0:1",
            "pix_fmt": "yuv420p",
            "level": 31,
            "chroma_location": "left",
            "refs": 1,
            "is_avc": "true",
            "nal_length_size": "4",
            "r_frame_rate": "30/1",
            "avg_frame_rate": "30/1",
            "time_base": "1/15360",
            "start_pts": 0,
            "start_time": "0.000000",
            "duration_ts": 2077194,
            "duration": "135.233984",
            "bit_rate": "2401573",
            "bits_per_raw_sample": "8",
            "nb_frames": "4057",
            "disposition": {
                "default": 1,
                "dub": 0,
                "original": 0,
                "comment": 0,
                "lyrics": 0,
                "karaoke": 0,
                "forced": 0,
                "hearing_impaired": 0,
                "visual_impaired": 0,
                "clean_effects": 0,
                "attached_pic": 0,
                "timed_thumbnails": 0
            },
            "tags": {
                "language": "und",
                "handler_name": "VideoHandler"
            }
        }
    ]
}`,
  "webm-no-duration": `{
    "streams": [
        {
            "index": 0,
            "codec_name": "vp8",
            "codec_long_name": "On2 VP8",
            "profile": "1",
            "codec_type": "video",
            "codec_time_base": "1/25",
            "codec_tag_string": "[0][0][0][0]",
            "codec_tag": "0x0000",
            "width": 640,
            "height": 360,
            "coded_width": 640,
            "coded_height": 360,
            "has_b_frames": 0,
            "sample_aspect_ratio": "1:1",
            "display_aspect_ratio": "16:9",
            "pix_fmt": "yuv420p",
            "level": -99,
            "field_order": "progressive",
            "refs": 1,
            "r_frame_rate": "25/1",
            "avg_frame_rate": "25/1",
            "time_base": "1/1000",
            "start_pts": 0,
            "start_time": "0.000000",
            "disposition": {
                "default": 1,
                "dub": 0,
                "original": 0,
                "comment": 0,
                "lyrics": 0,
                "karaoke": 0,
                "forced": 0,
                "hearing_impaired": 0,
                "visual_impaired": 0,
                "clean_effects": 0,
                "attached_pic": 0,
                "timed_thumbnails": 0
            },
            "tags": {
                "language": "eng"
            }
        },
        {
            "index": 1,
            "codec_name": "vorbis",
            "codec_long_name": "Vorbis",
            "codec_type": "audio",
            "codec_time_base": "1/44100",
            "codec_tag_string": "[0][0][0][0]",
            "codec_tag": "0x0000",
            "sample_fmt": "fltp",
            "sample_rate": "44100",
            "channels": 1,
            "channel_layout": "mono",
            "bits_per_sample": 0,
            "r_frame_rate": "0/0",
            "avg_frame_rate": "0/0",
            "time_base": "1/1000",
            "start_pts": 0,
            "start_time": "0.000000",
            "disposition": {
                "default": 1,
                "dub": 0,
                "original": 0,
                "comment": 0,
                "lyrics": 0,
                "karaoke": 0,
                "forced": 0,
                "hearing_impaired": 0,
                "visual_impaired": 0,
                "clean_effects": 0,
                "attached_pic": 0,
                "timed_thumbnails": 0
            },
            "tags": {
                "language": "eng"
            }
        }
    ]
}`,
};

describe('InfoExtractor Link Parsing', () => {
  // Testing link parsing for specific services has been moved to their respective describe blocks

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
});

describe('InfoExtractor Bulk Retrieval', () => {
  beforeEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  it("should get the correct video metadata for multiple videos with only one call to the youtube API", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q,I3O9J02G67I"]) });
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
    jest.spyOn(storage, "getManyVideoInfo").mockResolvedValue(videos);
    jest.spyOn(storage, "updateManyVideoInfo").mockResolvedValue(true);

    expect(await InfoExtract.getManyVideoInfo(videos)).toEqual([
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg",
        length: 10,
      }),
    ]);
    expect(storage.getManyVideoInfo).toHaveBeenCalledTimes(1);
    expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);
    expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(1);

    InfoExtract.YtApi.get.mockRestore();
    storage.getManyVideoInfo.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should get the correct video metadata for multiple videos with only 2 calls to the youtube API", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockImplementation(url => {
      if (url.includes("BTZ5KVRUy1Q")) {
        return Promise.resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
      }
      else if (url.includes("I3O9J02G67I")) {
        return Promise.resolve({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["I3O9J02G67I"]) });
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
    jest.spyOn(storage, "getManyVideoInfo").mockResolvedValue(videos);
    jest.spyOn(storage, "updateManyVideoInfo").mockResolvedValue(true);

    expect(await InfoExtract.getManyVideoInfo(videos)).toEqual([
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/default.jpg",
        length: 10,
      }),
    ]);
    expect(storage.getManyVideoInfo).toHaveBeenCalledTimes(1);
    expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(2);
    expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(2);

    InfoExtract.YtApi.get.mockRestore();
    storage.getManyVideoInfo.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });
});

describe("InfoExtractor Youtube Support", () => {
  afterEach(() => {
    InfoExtract.redisClient.get.mockClear();
    InfoExtract.redisClient.set.mockClear();
  });

  it('getService() should return youtube when given youtube link', () => {
    expect(InfoExtract.getService("http://youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("http://www.youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://www.youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://m.youtube.com/watch?v=I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("http://youtu.be/I3O9J02G67I")).toEqual("youtube");
    expect(InfoExtract.getService("https://youtu.be/I3O9J02G67I")).toEqual("youtube");
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

  it('getChannelIdYoutube() should return correct object', () => {
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg?view_as=subscriber")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/videos")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/playlists")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/community")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/channels")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/about")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/featured")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/channel/UCcVClhnvO2PaYoiJstwphpg/asdfsadflkj")).toEqual({ channel: "UCcVClhnvO2PaYoiJstwphpg" });
    expect(InfoExtract.getChannelIdYoutube("https://youtube.com/user/rollthedyc3")).toEqual({ user: "rollthedyc3" });
    expect(InfoExtract.getChannelIdYoutube("https://youtube.com/c/rollthedyc3")).toEqual({ user: "rollthedyc3" });
    expect(InfoExtract.getChannelIdYoutube("https://youtube.com/rollthedyc3")).toEqual({ user: "rollthedyc3" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/c/rollthedyc3/videos")).toEqual({ user: "rollthedyc3" });
    expect(InfoExtract.getChannelIdYoutube("https://www.youtube.com/c/rollthedyc3/videos?view_as=subscriber")).toEqual({ user: "rollthedyc3" });
  });

  it("should get 1 video", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    expect.assertions(2);
    await InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"]).then(results => {
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }));
    });
    expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should get 1 video with onlyProperties set", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    expect.assertions(2);
    // eslint-disable-next-line array-bracket-newline
    await InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], ["title", "description", "thumbnail", "length"]).then(results => {
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);
    });

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should get 2 videos", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q,I3O9J02G67I"]) });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    expect.assertions(3);
    // eslint-disable-next-line array-bracket-newline
    await InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q", "I3O9J02G67I"]).then(results => {
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
    });

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should attempt fallback if it fails to get video due to quota limit, and length is requested", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 403 } });
    jest.spyOn(InfoExtract, "getVideoLengthYoutube_Fallback").mockResolvedValue(10);
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockRejectedValue(true);

    expect.assertions(3);
    await InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], ["length"]).then(results => {
      expect(InfoExtract.getVideoLengthYoutube_Fallback).toHaveBeenCalled();
      expect(results["BTZ5KVRUy1Q"]).toEqual(new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        length: 10,
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg",
      }));
      expect(storage.updateManyVideoInfo).toHaveBeenCalled();
    });

    InfoExtract.YtApi.get.mockRestore();
    InfoExtract.getVideoLengthYoutube_Fallback.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should fail to get video due to quota limit, and length is not requested", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 403 } });
    jest.spyOn(InfoExtract, "getVideoLengthYoutube_Fallback").mockResolvedValue(10);
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockRejectedValue(true);

    await expect(InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], ["title"])).rejects.toThrow(/API quota/);
    expect(InfoExtract.getVideoLengthYoutube_Fallback).not.toHaveBeenCalled();
    expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();

    InfoExtract.YtApi.get.mockRestore();
    InfoExtract.getVideoLengthYoutube_Fallback.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should fail to get video due to other reasons", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue(new Error());
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    await expect(InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"])).rejects.toThrow();
    expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(1);
    expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should fail to get video because ids is not an array", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    await expect(InfoExtract.getVideoInfoYoutube("BTZ5KVRUy1Q")).rejects.toThrow();
    expect(InfoExtract.YtApi.get).not.toHaveBeenCalled();
    expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should fail to get video because onlyProperties is an empty array", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    await expect(InfoExtract.getVideoInfoYoutube(["BTZ5KVRUy1Q"], [])).rejects.toThrow("onlyProperties must have valid values or be null!");
    expect(InfoExtract.YtApi.get).not.toHaveBeenCalled();
    expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should get videos in the given youtube playlist", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubePlaylistItemsSampleResponses["PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm"]) });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    expect(await InfoExtract.getPlaylistYoutube("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")).toEqual([
      new Video({
        service: "youtube",
        id: "zgxj_0xPleg",
        title: "Chris Chan: A Comprehensive History - Part 1",
        description: "(1982-2000)",
        thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
      }),
      new Video({
        service: "youtube",
        id: "_3QMqssyBwQ",
        title: "Chris Chan: A Comprehensive History - Part 2",
        description: "(2000-2004)",
        thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
      }),
    ]);

    expect(InfoExtract.YtApi.get).toHaveBeenCalled();
    expect(storage.updateManyVideoInfo).toHaveBeenCalledTimes(1);

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should fail when youtube playlist request fails due to quota limit", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 403 } });
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    await expect(InfoExtract.getPlaylistYoutube("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")).rejects.toThrow(/API quota/);
    expect(InfoExtract.YtApi.get).toHaveBeenCalled();
    expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should fail when youtube playlist request fails due to other reasons", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue(new Error());
    jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation().mockResolvedValue(true);

    await expect(InfoExtract.getPlaylistYoutube("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")).rejects.toThrow();
    expect(storage.updateManyVideoInfo).not.toHaveBeenCalled();

    InfoExtract.YtApi.get.mockRestore();
    storage.updateManyVideoInfo.mockRestore();
  });

  it("should get videos on the given youtube channel", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeChannelInfoSampleResponses["UC_3pplzbKMZsP5zBH_6SVJQ"]) });
    jest.spyOn(InfoExtract, 'getPlaylistYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);

    expect(await InfoExtract.getChanneInfoYoutube({ channel: "UC_3pplzbKMZsP5zBH_6SVJQ" })).toEqual([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(1);

    InfoExtract.YtApi.get.mockRestore();
    InfoExtract.getPlaylistYoutube.mockRestore();
  });

  it("should fail when youtube channel request fails due to quota limit", async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 403 } });

    await expect(InfoExtract.getChanneInfoYoutube({ channel: "UC_3pplzbKMZsP5zBH_6SVAS" })).rejects.toThrow(/API quota/);
    expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(1);

    InfoExtract.YtApi.get.mockRestore();
  });

  it("should fail when youtube channel request fails for other reasons", async () => {
    jest.genMockFromModule("../../../redisclient.js");
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockRejectedValue(new Error());

    await expect(InfoExtract.getChanneInfoYoutube({ channel: "UC_3pplzbKMZsP5zBH_6SV73" })).rejects.toThrow();
    expect(InfoExtract.YtApi.get).toHaveBeenCalledTimes(1);

    InfoExtract.YtApi.get.mockRestore();
  });

  it("should search youtube and parse results without failing", async () => {
    jest.genMockFromModule("../../../redisclient.js");
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeSearchSampleResponses["family guy funny moments"]) });

    expect(await InfoExtract.searchYoutube("family guy funny moments")).toEqual([
      new Video({
        service: "youtube",
        id: "UJXZihZCP2g",
      }),
      new Video({
        service: "youtube",
        id: "ysEdZ3KWYIU",
      }),
      new Video({
        service: "youtube",
        id: "Tu3TiESKJGk",
      }),
    ]);
    expect(InfoExtract.redisClient.set).toBeCalled();

    InfoExtract.YtApi.get.mockRestore();
  });

  it("should search youtube using the extra options", async () => {
    jest.genMockFromModule("../../../redisclient.js");
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeSearchSampleResponses["family guy funny moments"]) });

    expect(await InfoExtract.searchYoutube("family guy funny moments", { maxResults: 3, fromUser: "test" })).toHaveLength(3);
    expect(InfoExtract.redisClient.get).toBeCalled();
    expect(InfoExtract.YtApi.get).toBeCalled();
    expect(InfoExtract.YtApi.get.mock.calls[0][0]).toContain("maxResults=3");
    expect(InfoExtract.YtApi.get.mock.calls[0][0]).toContain("quotaUser=test");

    InfoExtract.YtApi.get.mockRestore();
  });
});

describe("InfoExtractor Vimeo Support", () => {
  it('getService() should return vimeo when given vimeo link', () => {
    expect(InfoExtract.getService("https://vimeo.com/94338566")).toEqual("vimeo");
  });

  it('getVideoIdVimeo() should return correct id when given vimeo link', () => {
    expect(InfoExtract.getVideoIdVimeo("https://vimeo.com/94338566")).toEqual("94338566");
    expect(InfoExtract.getVideoIdVimeo("https://vimeo.com/94338566?t=2")).toEqual("94338566");
    expect(InfoExtract.getVideoIdVimeo("https://vimeo.com/channels/susisie/94338566")).toEqual("94338566");
  });

  it("should handle single video", async () => {
    jest.spyOn(InfoExtract.VimeoApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(vimeoOEmbedSampleResponses["94338566"]) });
    jest.spyOn(storage, 'updateVideoInfo').mockImplementation();

    expect(await InfoExtract.getVideoInfoVimeo("94338566")).toEqual(new Video({
      service: "vimeo",
      id: "94338566",
      title: "Showreel",
      description: "No animation. No 3D. Just reality.",
      thumbnail: "https://i.vimeocdn.com/video/474246782_295x166.jpg",
      length: 70,
    }));
    expect(InfoExtract.VimeoApi.get).toHaveBeenCalledTimes(1);
    expect(storage.updateVideoInfo).toHaveBeenCalledTimes(1);

    InfoExtract.VimeoApi.get.mockRestore();
    storage.updateVideoInfo.mockRestore();
  });

  it("should handle video with embedding disabled gracefully", async () => {
    jest.spyOn(InfoExtract.VimeoApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 403 } });
    jest.spyOn(storage, 'updateVideoInfo').mockImplementation();

    expect(await InfoExtract.getVideoInfoVimeo("94338566")).toBeNull();
    expect(InfoExtract.VimeoApi.get).toHaveBeenCalledTimes(1);
    expect(storage.updateVideoInfo).not.toHaveBeenCalled();

    InfoExtract.VimeoApi.get.mockRestore();
    storage.updateVideoInfo.mockRestore();
  });

  it("should handle other failures gracefully", async () => {
    jest.spyOn(InfoExtract.VimeoApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 200 } });
    jest.spyOn(storage, 'updateVideoInfo').mockImplementation();

    expect(await InfoExtract.getVideoInfoVimeo("94338566")).toEqual(new Video({
      service: "vimeo",
      id: "94338566",
    }));
    expect(InfoExtract.VimeoApi.get).toHaveBeenCalledTimes(1);
    expect(storage.updateVideoInfo).not.toHaveBeenCalled();

    InfoExtract.VimeoApi.get.mockRestore();
    storage.updateVideoInfo.mockRestore();
  });
});

describe("InfoExtractor Dailymotion Support", () => {
  it('getService() should return dailymotion when given dailymotion link', () => {
    expect(InfoExtract.getService("https://www.dailymotion.com/video/x6hkywd")).toEqual("dailymotion");
    expect(InfoExtract.getService("https://dai.ly/x6hkywd")).toEqual("dailymotion");
  });

  it('getVideoIdDailymotion() should return correct id when given dailymotion link', () => {
    expect(InfoExtract.getVideoIdDailymotion("https://www.dailymotion.com/video/x6hkywd")).toEqual("x6hkywd");
    expect(InfoExtract.getVideoIdDailymotion("https://www.dailymotion.com/video/x6hkywd?start=120")).toEqual("x6hkywd");
    expect(InfoExtract.getVideoIdDailymotion("https://dai.ly/x6hkywd")).toEqual("x6hkywd");
  });

  it("should handle single video", async () => {
    jest.spyOn(InfoExtract.DailymotionApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(dailymotionVideoInfoSampleResponses["x1fz4ii"]) });
    jest.spyOn(storage, 'updateVideoInfo').mockImplementation();

    expect(await InfoExtract.getVideoInfoDailymotion("x1fz4ii")).toEqual(new Video({
      service: "dailymotion",
      id: "x1fz4ii",
      title: "Hackathon BeMyApp/Dailymotion",
      description: "This is a video that was done after our hackathon",
      thumbnail: "https://s2.dmcdn.net/v/7sRg71UN0OKwaG4Wj",
      length: 213,
    }));
    expect(InfoExtract.DailymotionApi.get).toHaveBeenCalledTimes(1);
    expect(storage.updateVideoInfo).toHaveBeenCalledTimes(1);

    InfoExtract.DailymotionApi.get.mockRestore();
    storage.updateVideoInfo.mockRestore();
  });

  it("should handle other failures gracefully", async () => {
    jest.spyOn(InfoExtract.DailymotionApi, 'get').mockImplementation().mockRejectedValue({ response: { status: 500 } });
    jest.spyOn(storage, 'updateVideoInfo').mockImplementation();

    expect(await InfoExtract.getVideoInfoDailymotion("x1fz4ii")).toBeNull();
    expect(InfoExtract.DailymotionApi.get).toHaveBeenCalledTimes(1);
    expect(storage.updateVideoInfo).not.toHaveBeenCalled();

    InfoExtract.DailymotionApi.get.mockRestore();
    storage.updateVideoInfo.mockRestore();
  });
});

describe("InfoExtractor Google Drive Support", () => {
  it('getService() should return googledrive when given google drive link', () => {
    expect(InfoExtract.getService("https://drive.google.com/file/d/1KxVGtZ2W8sAq9r3xx0t8TLkjq96Np9aw/view?usp=sharing")).toEqual("googledrive");
    expect(InfoExtract.getService("https://drive.google.com/file/d/1KII8vJ80JCTJxKVnwFqtEAU85pjcSKzq/view")).toEqual("googledrive");
    expect(InfoExtract.getService("https://drive.google.com/open?id=1rx4j-79UXk0PXccDwTxnrVVMenGopDIN")).toEqual("googledrive");
  });

  it('getVideoIdGoogleDrive() should return correct id when given google drive link', () => {
    expect(InfoExtract.getVideoIdGoogleDrive("https://drive.google.com/file/d/1KxVGtZ2W8sAq9r3xx0t8TLkjq96Np9aw/view?usp=sharing")).toEqual("1KxVGtZ2W8sAq9r3xx0t8TLkjq96Np9aw");
    expect(InfoExtract.getVideoIdGoogleDrive("https://drive.google.com/file/d/1KII8vJ80JCTJxKVnwFqtEAU85pjcSKzq/view")).toEqual("1KII8vJ80JCTJxKVnwFqtEAU85pjcSKzq");
    expect(InfoExtract.getVideoIdGoogleDrive("https://drive.google.com/open?id=1rx4j-79UXk0PXccDwTxnrVVMenGopDIN")).toEqual("1rx4j-79UXk0PXccDwTxnrVVMenGopDIN");
  });

  it("should return the folder id if the link is valid", () => {
    expect(InfoExtract.getFolderIdGoogleDrive("https://drive.google.com/drive/u/0/folders/0B3OoGtYynRDNM1hNZmJ5Unh0Qjg")).toBe("0B3OoGtYynRDNM1hNZmJ5Unh0Qjg");
    expect(InfoExtract.getFolderIdGoogleDrive("https://drive.google.com/drive/folders/0B3OoGtYynRDNM1hNZmJ5Unh0Qjg")).toBe("0B3OoGtYynRDNM1hNZmJ5Unh0Qjg");
  });
});

describe("InfoExtractor Direct File Support", () => {
  it('getService() should return direct when given direct video link', () => {
    expect(InfoExtract.getService("https://example.com/good.mp4")).toEqual("direct");
    expect(InfoExtract.getService("https://984-651-12-545.399babc383489b346b3c234.plex.direct:32400/library/parts/203/87986543524/file.mp4?download=0&X-Plex-Token=3446vbmngegvfghdmp59E")).toEqual("direct");
  });

  it("should return whether or not the mime type is supported", () => {
    expect(InfoExtract.isSupportedMimeType("video/mp4")).toBe(true);
    expect(InfoExtract.isSupportedMimeType("video/webm")).toBe(true);
    expect(InfoExtract.isSupportedMimeType("video/mov")).toBe(true);
    expect(InfoExtract.isSupportedMimeType("video/ogg")).toBe(true);
    expect(InfoExtract.isSupportedMimeType("video/x-flv")).toBe(false);
    expect(InfoExtract.isSupportedMimeType("video/x-matroska")).toBe(false);
    expect(InfoExtract.isSupportedMimeType("video/x-ms-wmv")).toBe(false);
    expect(InfoExtract.isSupportedMimeType("video/x-msvideo")).toBe(false);
  });

  it("should not accept strings referencing local files", async () => {
    await expect(InfoExtract.getVideoInfoDirect("file:///tmp/bad.mp4")).rejects.toThrow();
    await expect(InfoExtract.getVideoInfoDirect("file://C:/tmp/bad.mp4")).rejects.toThrow();
    await expect(InfoExtract.getVideoInfoDirect("file://G:/tmp/bad.mp4")).rejects.toThrow();
    await expect(InfoExtract.getVideoInfoDirect("/tmp/bad.mp4")).rejects.toThrow();
    await expect(InfoExtract.getVideoInfoDirect("C:\\tmp\\bad.mp4")).rejects.toThrow();
  });

  it("should not accept unsupported mime types", async () => {
    await expect(InfoExtract.getVideoInfoDirect("http://example.com/bad.mkv")).rejects.toThrow();
    await expect(InfoExtract.getVideoInfoDirect("http://example.com/bad.flv")).rejects.toThrow();
  });

  it("should return video when url is valid, and resource has duration metadata, only 1 stream", async () => {
    jest.spyOn(InfoExtract.ffprobe, 'getFileInfo').mockResolvedValue(JSON.parse(directVideoInfoFFProbe["mp4-no-audio"]));

    expect(await InfoExtract.getVideoInfoDirect("http://example.com/noaudio.mp4")).toEqual(new Video({
      service: "direct",
      url: "http://example.com/noaudio.mp4",
      title: "noaudio.mp4",
      description: "Full Link: http://example.com/noaudio.mp4",
      mime: "video/mp4",
      length: 136,
    }));

    InfoExtract.ffprobe.getFileInfo.mockRestore();
  });

  it("should return video when url is valid, and resource has duration metadata, and more than 1 stream", async () => {
    jest.spyOn(InfoExtract.ffprobe, 'getFileInfo').mockResolvedValue(JSON.parse(directVideoInfoFFProbe["normal-mp4"]));

    expect(await InfoExtract.getVideoInfoDirect("http://example.com/normal.mp4")).toEqual(new Video({
      service: "direct",
      url: "http://example.com/normal.mp4",
      title: "normal.mp4",
      description: "Full Link: http://example.com/normal.mp4",
      mime: "video/mp4",
      length: 102,
    }));

    InfoExtract.ffprobe.getFileInfo.mockRestore();
  });

  it("should fail when url is valid, and resource has no duration metadata", async () => {
    jest.spyOn(InfoExtract.ffprobe, 'getFileInfo').mockResolvedValue(JSON.parse(directVideoInfoFFProbe["webm-no-duration"]));

    await expect(InfoExtract.getVideoInfoDirect("http://example.com/noduration.webm")).rejects.toThrow();

    InfoExtract.ffprobe.getFileInfo.mockRestore();
  });

  it("should return video when file name has multiple '.' in the name", async () => {
    jest.spyOn(InfoExtract.ffprobe, 'getFileInfo').mockResolvedValue(JSON.parse(directVideoInfoFFProbe["normal-mp4"]));

    expect(await InfoExtract.getVideoInfoDirect("http://example.com/multiple.dots.mp4")).toEqual(new Video({
      service: "direct",
      url: "http://example.com/multiple.dots.mp4",
      title: "multiple.dots.mp4",
      description: "Full Link: http://example.com/multiple.dots.mp4",
      mime: "video/mp4",
      length: 102,
    }));
    await expect(InfoExtract.getVideoInfoDirect("")).rejects.toThrow();

    InfoExtract.ffprobe.getFileInfo.mockRestore();
  });
});

describe('InfoExtractor Caching Spec', () => {
  beforeEach(async () => {
    console.warn("CLEAR CACHE");
    await CachedVideo.destroy({ where: {} });
  });

  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  it('should get the correct video metadata', async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["BTZ5KVRUy1Q"]) });

    let video = await InfoExtract.getVideoInfo("youtube", "BTZ5KVRUy1Q");
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
  });

  it('should miss cache, get the correct video metadata, and store it in the cache', async () => {
    jest.spyOn(InfoExtract.YtApi, 'get').mockImplementation().mockResolvedValue({ status: 200, data: JSON.parse(youtubeVideoListSampleResponses["I3O9J02G67I"]) });

    expect(await CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).toBeNull();

    let video = await InfoExtract.getVideoInfo("youtube", "I3O9J02G67I");
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

    expect(await CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).toBeDefined();

    expect(InfoExtract.YtApi.get).toBeCalled();
  });

  it('should hit cache, get the correct video metadata from the cache', async () => {
    expect(await CachedVideo.count()).toEqual(0);

    expect(await CachedVideo.create({
      service: "fakeservice",
      serviceId: "abc123",
      title: "Test Title",
      description: "This is a test description.",
      thumbnail: "http://example.com/thumbnail.jpg",
      length: 32,
      mime: "fake/mime",
    })).toBeDefined();

    expect(await CachedVideo.count()).toEqual(1);

    let video = await InfoExtract.getVideoInfo("fakeservice", "abc123");
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
    expect(video.mime).toBe("fake/mime");

    expect(await CachedVideo.count()).toEqual(1);
    expect(await CachedVideo.findOne({ where: { service: "fakeservice", serviceId: "abc123" }})).toBeDefined();
  });

  it('should partially hit cache, get the missing video metadata (length), and store it in the cache', async () => {
    jest.spyOn(InfoExtract, 'getVideoInfoYoutube').mockImplementation().mockResolvedValue({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", length: 10 } });

    expect(await CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).toBeNull();

    expect(await CachedVideo.create({
      service: "youtube",
      serviceId: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
    })).toBeDefined();

    await CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }}).then(result => {
      expect(result).toBeDefined();
      expect(result.length).toBeNull();
    });

    let video = await InfoExtract.getVideoInfo("youtube", "I3O9J02G67I");
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

    expect(await CachedVideo.count()).toEqual(1);
    expect(await CachedVideo.findOne({ where: { service: "youtube", serviceId: "I3O9J02G67I" }})).toBeDefined();
  });
});

describe('InfoExtractor Partial Data Retrieval', () => {
  it('should detect if length is missing from the cached video info', done => {
    jest.spyOn(storage, 'getVideoInfo').mockImplementation().mockResolvedValue({
      "service": "youtube",
      "id": "I3O9J02G67I",
      "title": "tmpATT2Cp",
      "description": "tmpATT2Cp",
      "thumbnail": "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
    });
    jest.spyOn(InfoExtract, 'getVideoInfoYoutube').mockImplementation().mockResolvedValue({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", length: 10 } });

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(video => {
      expect(InfoExtract.getVideoInfoYoutube).toBeCalledWith(["I3O9J02G67I"], ["length"]);
      expect(video).toBeDefined();
      done();
    });
  });

  it('should detect if title is missing from the cached video info', done => {
    jest.spyOn(storage, 'getVideoInfo').mockImplementation().mockResolvedValue({
      "service": "youtube",
      "id": "I3O9J02G67I",
      "description": "tmpATT2Cp",
      "thumbnail": "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      "length": 10,
    });
    jest.spyOn(InfoExtract, 'getVideoInfoYoutube').mockImplementation().mockResolvedValue({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", title: "tmpATT2Cp" } });

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(video => {
      expect(InfoExtract.getVideoInfoYoutube).toBeCalledWith(["I3O9J02G67I"], ["title"]);
      expect(video).toBeDefined();
      done();
    });
  });

  it('should detect if title and description is missing from the cached video info', done => {
    jest.spyOn(storage, 'getVideoInfo').mockImplementation().mockResolvedValue({
      "service": "youtube",
      "id": "I3O9J02G67I",
      "thumbnail": "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      "length": 10,
    });
    jest.spyOn(InfoExtract, 'getVideoInfoYoutube').mockImplementation().mockResolvedValue({ "I3O9J02G67I": { service: "youtube", id: "I3O9J02G67I", title: "tmpATT2Cp", description: "tmpATT2Cp" } });

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
  afterEach(() => {
    if (jest.isMockFunction(InfoExtract.getVideoInfo)) {
      InfoExtract.getVideoInfo.mockRestore();
    }
    if (jest.isMockFunction(InfoExtract.getManyVideoInfo)) {
      InfoExtract.getManyVideoInfo.mockRestore();
    }
    if (jest.isMockFunction(InfoExtract.getPlaylistYoutube)) {
      InfoExtract.getPlaylistYoutube.mockRestore();
    }
    if (jest.isMockFunction(InfoExtract.getChanneInfoYoutube)) {
      InfoExtract.getChanneInfoYoutube.mockRestore();
    }
    if (jest.isMockFunction(InfoExtract.searchYoutube)) {
      InfoExtract.searchYoutube.mockRestore();
    }
  });

  it('should return 1 video when given a long youtube URL', async () => {
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }));

    expect(await InfoExtract.getAddPreview("https://www.youtube.com/watch?v=I3O9J02G67I")).toHaveLength(1);
    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
  });

  it('should return 1 video when given a short youtube URL', async () => {
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }));

    expect(await InfoExtract.getAddPreview("https://youtu.be/I3O9J02G67I")).toHaveLength(1);
    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
  });

  it('should return at least 1 video when given a public youtube playlist', async () => {
    jest.spyOn(InfoExtract, 'getPlaylistYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    let videos = [
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
    ];
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue(videos);

    expect(await InfoExtract.getAddPreview("https://youtube.com/playlist?list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")).toEqual(videos);
    expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
    expect(InfoExtract.getManyVideoInfo).toBeCalled();
  });

  it('should return at least 1 video when given a youtube video that is in a public playlist', async () => {
    jest.spyOn(InfoExtract, 'getPlaylistYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    let videos = [
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
    ];
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue(videos);

    expect(await InfoExtract.getAddPreview("https://youtube.com/watch?v=I3O9J02G67I&list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm&index=1")).toEqual(videos);
    expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
    expect(InfoExtract.getManyVideoInfo).toBeCalled();
  });

  it('should highlight the video when given a youtube video that is in a public playlist', async () => {
    jest.spyOn(InfoExtract, 'getPlaylistYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    let videos = [
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
        highlight: true,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ];
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockResolvedValue(videos.map(video => _.omit(video, "highlight")));

    expect(await InfoExtract.getAddPreview("https://youtube.com/watch?v=I3O9J02G67I&list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm&index=1")).toEqual(videos);
    expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
    expect(InfoExtract.getManyVideoInfo).toBeCalled();
  });

  it('should guarentee the highlighted video is included', async () => {
    jest.spyOn(InfoExtract, 'getPlaylistYoutube').mockResolvedValue([
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    let videos = [
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
        title: "tmpATT2Cp",
        description: "tmpATT2Cp",
        thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
        length: 10,
        highlight: true,
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
        title: "tmpIwT4T4",
        description: "tmpIwT4T4",
        thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
        length: 10,
      }),
    ];
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockResolvedValue(videos.slice(1));
    jest.spyOn(InfoExtract, 'getVideoInfo').mockResolvedValue(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }));

    expect(await InfoExtract.getAddPreview("https://youtube.com/watch?v=I3O9J02G67I&list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm&index=1")).toEqual(videos);
    expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledWith("PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm");
    expect(InfoExtract.getPlaylistYoutube).toHaveBeenCalledTimes(1);
    expect(InfoExtract.getManyVideoInfo).toHaveBeenCalledWith([
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    expect(InfoExtract.getManyVideoInfo).toHaveBeenCalledTimes(1);
    expect(InfoExtract.getVideoInfo).toHaveBeenCalledWith("youtube", "I3O9J02G67I");
    expect(InfoExtract.getVideoInfo).toHaveBeenCalledTimes(1);
  });

  it('should return at 1 video when given a youtube video that is in a private playlist', done => {
    jest.spyOn(InfoExtract, 'getPlaylistYoutube').mockImplementation().mockRejectedValue(new Error("fake error"));
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue([]);
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue(new Video({
      service: "youtube",
      id: "I3O9J02G67I",
      title: "tmpATT2Cp",
      description: "tmpATT2Cp",
      thumbnail: "https://i.ytimg.com/vi/I3O9J02G67I/mqdefault.jpg",
      length: 10,
    }));

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
    jest.spyOn(InfoExtract, 'getChanneInfoYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue([
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
    ]);

    InfoExtract.getAddPreview("https://www.youtube.com/channel/UC_3pplzbKMZsP5zBH_6SVJQ").then(result => {
      expect(InfoExtract.getChanneInfoYoutube).toBeCalled();
      expect(InfoExtract.getChanneInfoYoutube).toBeCalledWith({ channel: "UC_3pplzbKMZsP5zBH_6SVJQ" });
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);

      done();
    });
  });

  it('should return at least 1 video when given a custom youtube channel url', done => {
    jest.spyOn(InfoExtract, 'getChanneInfoYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue([
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
    ]);

    InfoExtract.getAddPreview("https://www.youtube.com/user/GenoSamuel1994Part2").then(result => {
      expect(InfoExtract.getChanneInfoYoutube).toBeCalled();
      expect(InfoExtract.getChanneInfoYoutube).toBeCalledWith({ user: "GenoSamuel1994Part2" });
      expect(InfoExtract.getManyVideoInfo).toBeCalled();
      expect(result).toHaveLength(2);

      done();
    });
  });

  it('should search youtube and return at least 1 video when given a non url input', done => {
    jest.spyOn(InfoExtract, 'searchYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue([
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
    ]);
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
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue(new Video({
      service: "vimeo",
      id: "94338566",
      title: "Showreel",
      description: "No animation. No 3D. Just reality.",
      thumbnail: "https://i.vimeocdn.com/video/474246782_295x166.jpg",
      length: 70,
    }));

    InfoExtract.getAddPreview("https://vimeo.com/videos/94338566").then(result => {
      expect(InfoExtract.getVideoInfo).toBeCalled();
      expect(result).toHaveLength(1);

      done();
    });
  });

  it('should get youtube channel info when given short channel links', async () => {
    jest.spyOn(InfoExtract, 'getChanneInfoYoutube').mockImplementation().mockResolvedValue([
      new Video({
        service: "youtube",
        id: "I3O9J02G67I",
      }),
      new Video({
        service: "youtube",
        id: "BTZ5KVRUy1Q",
      }),
    ]);
    jest.spyOn(InfoExtract, 'getManyVideoInfo').mockImplementation().mockResolvedValue([
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
    ]);

    let result = await InfoExtract.getAddPreview("https://www.youtube.com/c/BoshMind");
    expect(InfoExtract.getChanneInfoYoutube).toBeCalled();
    expect(InfoExtract.getChanneInfoYoutube).toBeCalledWith({ user: "BoshMind" });
    expect(InfoExtract.getManyVideoInfo).toBeCalled();
    expect(result).toHaveLength(2);

    InfoExtract.getChanneInfoYoutube.mockClear();
    InfoExtract.getManyVideoInfo.mockClear();

    result = await InfoExtract.getAddPreview("https://youtube.com/rollthedyc3");
    expect(InfoExtract.getChanneInfoYoutube).toBeCalled();
    expect(InfoExtract.getChanneInfoYoutube).toBeCalledWith({ user: "rollthedyc3" });
    expect(InfoExtract.getManyVideoInfo).toBeCalled();
    expect(result).toHaveLength(2);
  });
});
