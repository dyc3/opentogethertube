const SpotifyAdapter = require("../../../../server/services/spotify");
const Video = require("../../../../common/video");
import axios from 'axios';

describe("canHandleURL", () => {
  const adapter = new SpotifyAdapter("");

  it("Accepts share links", () => {
    const url =
      "https://open.spotify.com/track/6sGiI7V9kgLNEhPIxEJDii?si=I8a1t1eBQ-CqhTzece9qdA";
    expect(adapter.canHandleURL(url)).toBe(true);
  });

  it("Rejects other URLs", () => {
    const url = "https://example.com/somevideo";
    expect(adapter.canHandleURL(url)).toBe(false);
  });
});

describe("initApi", () => {
  const adapter = new SpotifyAdapter("");

  it("Login in spotify web api and get a token", () => {
    const token = "BQAumpyD9B4Fht4rQs0avScyGC6CgMpyL8FBeURAHaH9-xU2zZsPO6NNZMsNPsYi4sffFHfwtANwy46A97fjv6nFiX9rewh4uMt1Kk74V1pQUBp0XW7f0zDbMqsxMOu6mWgHOrwQPXbE_hxOtHcfXX1qR5ZNALgYGscUfyjvIpfuMCMvH4nQkxPvgf7bqHaHriKG9gaa",
      tokenType = "bearer";
    adapter.initApi();
    jest.mock('axios');
    const data = {
      "access_token": token,
      "token_type": tokenType,
      "expires_in": 3600,
    };
    axios.mockImplementationOnce(() => Promise.resolve(data));
    expect(adapter.token).toBe("bearer");
    expect(adapter.tokenType).toBe(tokenType);
  });

});

describe("isCollectionURL", () => {
  const adapter = new SpotifyAdapter("");

  it("Returns true for album", () => {
    const url =
      "https://open.spotify.com/album/2qVM4OAn9U9ZXHVKV0zIiJ?si=oTlt7PbQSEutR4oNduOiIA";
    expect(adapter.isCollectionURL(url)).toBe(true);
  });

  it("Returns true for playlist", () => {
    const url =
      "https://open.spotify.com/playlist/4l1oZ35CQatacQ49ez34ca";
    expect(adapter.isCollectionURL(url)).toBe(true);
  });

  it("Returns false for other URLs", () => {
    const url =
      "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
    expect(adapter.isCollectionURL(url)).toBe(false);
  });
});

describe("getVideoId", () => {
  const adapter = new SpotifyAdapter("");

  it("Extracts file IDs", () => {
    const url =
      "https://open.spotify.com/track/6sGiI7V9kgLNEhPIxEJDii";
    expect(adapter.getVideoId(url)).toBe("6sGiI7V9kgLNEhPIxEJDii");
  });
});

describe("fetchVideoInfo", () => {
  const adapter = new SpotifyAdapter("");

  it("Get video info", () => {
    const video = new Video({
      service: "spotify",
      id: "6sGiI7V9kgLNEhPIxEJDii",
      title: "Ram Ranch",
      description: "track Ram Ranch 6:49",
      thumbnail: "https://i.scdn.co/image/ab67616d00004851703c4a4ed1374cd364afe7af",
      length: "409413",
    });
    expect(adapter.fetchVideoInfo("6sGiI7V9kgLNEhPIxEJDii")).toBe(video);
  });
});

describe("resolveURL", () => {
  const adapter = new SpotifyAdapter("");
  it("resolveURL test incomplete", () => {
    const url ="https://open.spotify.com/track/6sGiI7V9kgLNEhPIxEJDii";
    expect(adapter.resolveURL(url)).toBe([]);
  });
});
