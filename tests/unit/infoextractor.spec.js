const fs = require('fs');
const path = require('path');
const InfoExtract = require("../../infoextract");
const { CachedVideo } = require("../../models");

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
  console.error("No config found! Things will break!", config_path);
}
require('dotenv').config({ path: config_path });

describe('InfoExtractor Spec', () => {
  beforeEach(async () => {
    console.warn("CLEAR CACHE");
    await CachedVideo.destroy({ where: {} });
  }),

  afterEach(async () => {

  }),

  it('should get the correct video metadata', done => {
      InfoExtract.getVideoInfo("youtube", "BTZ5KVRUy1Q").then(video => {
        expect(video).toBeDefined();
        expect(video.service).toBeDefined();
        expect(video.service).toBe("youtube");
        expect(video.service_id).toBeUndefined();
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
    await expect(CachedVideo.findOne({ where: { service: "youtube", service_id: "I3O9J02G67I" }})).resolves.toBeNull();

    InfoExtract.getVideoInfo("youtube", "I3O9J02G67I").then(async video => {
      expect(video).toBeDefined();
      expect(video.service).toBeDefined();
      expect(video.service).toBe("youtube");
      expect(video.service_id).toBeUndefined();
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
      await expect(CachedVideo.findOne({ where: { service: "youtube", service_id: "I3O9J02G67I" }})).resolves.toBeDefined();
      done();
    }).catch(err => done.fail(err));
  });

  it('should hit cache, get the correct video metadata from the cache', async done => {
    await expect(CachedVideo.count()).resolves.toEqual(0);

    await expect(CachedVideo.create({
      service: "fakeservice",
      service_id: "abc123",
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
      expect(video.service_id).toBeUndefined();
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
      await expect(CachedVideo.findOne({ where: { service: "fakeservice", service_id: "abc123" }})).resolves.toBeDefined();
      done();
    }).catch(err => done.fail(err));
  });
});
