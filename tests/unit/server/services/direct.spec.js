jest.mock("../../../../ffprobe");

const DirectVideoAdapter = require("../../../../server/services/direct");
const ffprobe = require("../../../../ffprobe");
const Video = require("../../../../common/video");

describe("canHandleURL", () => {
  const supportedExtensions = [
    "mp4",
    "mp4v",
    "mpg4",
    "webm",
    "flv",
    "mkv",
    "avi",
    "wmv",
    "qt",
    "mov",
    "ogv",
    "m4v",
    "h264",
  ];

  const adapter = new DirectVideoAdapter();

  it.each(supportedExtensions)("Accepts %s links", (extension) => {
    const url = `https://example.com/test.${extension}`;
    expect(adapter.canHandleURL(url)).toBe(true);
  });

  it("Rejects unsupported extensions", () => {
    const url = "https://example.com/test.jpg";
    expect(adapter.canHandleURL(url)).toBe(false);
  });
});

describe("isCollectionURL", () => {
  const adapter = new DirectVideoAdapter();

  it("Always returns false because collections aren't supported", () => {
    const url = "https://example.com/test.mp4";
    expect(adapter.isCollectionURL(url)).toBe(false);
  });
});

describe("getVideoId", () => {
  const adapter = new DirectVideoAdapter();

  it("Returns the link itself as the ID", () => {
    const url = "https://example.com/test.mp4";
    expect(adapter.getVideoId(url)).toBe(url);
  });
});

describe("fetchVideoInfo", () => {
  const adapter = new DirectVideoAdapter();

  beforeEach(() => {
    ffprobe.getFileInfo.mockClear();
    ffprobe.getFileInfo.mockResolvedValue({
      streams: [
        {
          codec_type: "video",
          duration: 100,
        },
      ],
    });
  });

  it("Returns a promise", async () => {
    const url = "https://example.com/test.mp4";
    expect(adapter.fetchVideoInfo(url)).toBeInstanceOf(Promise);
  });

  it("Returns a video", async () => {
    const url = "https://example.com/test.mp4";
    const video = await adapter.fetchVideoInfo(url);
    expect(video).toBeInstanceOf(Video);
    expect(video).toMatchObject({
      id: url,
      url: url,
      length: 100,
    });
  });
});
