const SpotifyAdapter = require("../../../../server/services/spotify");
const Video = require("../../../../common/video");

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
 
});

describe("resolveURL", () => {
  const adapter = new SpotifyAdapter("");
});

describe("getTrackIdSpotify", () => {
    const adapter = new SpotifyAdapter("");
    it("getTrackIdSpotify() should return correct Id", () => {
      expect(adapter.getTrackIdSpotify("https://open.spotify.com/track/6sGiI7V9kgLNEhPIxEJDii?si=I8a1t1eBQ-CqhTzece9qdA")).toEqual("6sGiI7V9kgLNEhPIxEJDii");
      expect(adapter.getTrackIdSpotify("https://open.spotify.com/track/7cwN43wYufgU7QyEctjf1G?si=bgZW5cTQQ0O8e7W12cyedw")).toEqual("7cwN43wYufgU7QyEctjf1G");
      expect(adapter.getTrackIdSpotify("https://open.spotify.com/album/2qVM4OAn9U9ZXHVKV0zIiJ?si=oTlt7PbQSEutR4oNduOiIA")).toEqual("2qVM4OAn9U9ZXHVKV0zIiJ?si=oTlt7PbQSEutR4oNduOiIA");
      expect(adapter.getTrackIdSpotify("https://open.spotify.com/playlist/4l1oZ35CQatacQ49ez34ca")).toEqual("4l1oZ35CQatacQ49ez34ca");
      expect(adapter.getTrackIdSpotify("spotify:track:7cwN43wYufgU7QyEctjf1G")).toEqual("7cwN43wYufgU7QyEctjf1G");
    });
  });
