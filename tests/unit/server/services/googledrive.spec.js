const GoogleDriveAdapter = require("../../../../server/services/googledrive");
const Video = require("../../../../common/video");

describe("canHandleURL", () => {
  const adapter = new GoogleDriveAdapter("");

  it("Accepts share links", () => {
    const url =
      "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
    expect(adapter.canHandleURL(url)).toBe(true);
  });

  it("Rejects other URLs", () => {
    const url = "https://example.com/somevideo";
    expect(adapter.canHandleURL(url)).toBe(false);
  });
});

describe("isCollectionURL", () => {
  const adapter = new GoogleDriveAdapter("");

  it("Returns true for folders", () => {
    const url =
      "https://drive.google.com/drive/folders/bnas098dh9asund982hlkahsd9?usp=sharing";
    expect(adapter.isCollectionURL(url)).toBe(true);
  });

  it("Returns false for other URLs", () => {
    const url =
      "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
    expect(adapter.isCollectionURL(url)).toBe(false);
  });
});

describe("getVideoId", () => {
  const adapter = new GoogleDriveAdapter("");

  it("Extracts file IDs", () => {
    const url =
      "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
    expect(adapter.getVideoId(url)).toBe("0ashda098sd892oihas");
  });
});

describe("fetchVideoInfo", () => {
  const adapter = new GoogleDriveAdapter("");
  jest.spyOn(adapter.api, "get");
  const videoId = "08ahsdlk0218";
  adapter.api.get.mockResolvedValue({
    data: {
      id: videoId,
      name: "Test video",
      thumbnailLink: "https://example.com/thumbnail.jpg",
      videoMediaMetadata: {
        durationMillis: 100000,
      },
      mimeType: "video/mp4",
    },
  });

  it("Returns a promise", () => {
    expect(adapter.fetchVideoInfo(videoId)).toBeInstanceOf(Promise);
  });

  it("Queries the Google Drive API", () => {
    expect(adapter.api.get).toBeCalled();
  });

  it("Returns a video", async () => {
    const video = await adapter.fetchVideoInfo(videoId);

    expect(video).toBeInstanceOf(Video);
    expect(video).toMatchObject({
      service: "googledrive",
      id: videoId,
      thumbnail: "https://example.com/thumbnail.jpg",
      length: 100,
      mime: "video/mp4",
    });
  });
});

describe("resolveURL", () => {
  const adapter = new GoogleDriveAdapter("");
  jest.spyOn(adapter.api, "get");

  it("Resolves URLs to single videos", async () => {
    const url =
      "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";

    const videoId = "0ashda098sd892oihas";
    adapter.api.get.mockResolvedValue({
      data: {
        id: videoId,
        name: "Test video",
        thumbnailLink: "https://example.com/thumbnail.jpg",
        videoMediaMetadata: {
          durationMillis: 100000,
        },
        mimeType: "video/mp4",
      },
    });

    const video = await adapter.resolveURL(url);
    expect(video).toBeInstanceOf(Video);
  });

  it("Resolves a folder URL to a list of videos", async () => {
    const folderId = "bnas098dh9asund982hlkahsd9";
    const url = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
    adapter.api.get.mockResolvedValue({
      data: {
        files: [
          {
            id: "video1",
            name: "Video One",
            thumbnailLink: "thumbnail1",
            videoMediaMetadata: { durationMillis: 100000 },
            mimeType: "video/mp4",
          },
          {
            id: "video2",
            name: "Video Two",
            thumbnailLink: "thumbnail2",
            videoMediaMetadata: { durationMillis: 200000 },
            mimeType: "video/mp4",
          },
        ],
      },
    });
    const videos = await adapter.resolveURL(url);

    expect(Array.isArray(videos)).toBe(true);
    expect(videos.length).toBe(2);

    expect(videos[0]).toBeInstanceOf(Video);
    expect(videos[0]).toMatchObject({
      service: "googledrive",
      id: "video1",
      title: "Video One",
      thumbnail: "thumbnail1",
      length: 100,
      mime: "video/mp4",
    });

    expect(videos[1]).toBeInstanceOf(Video);
    expect(videos[1]).toMatchObject({
      service: "googledrive",
      id: "video2",
      title: "Video Two",
      thumbnail: "thumbnail2",
      length: 200,
      mime: "video/mp4",
    });
  });
});
