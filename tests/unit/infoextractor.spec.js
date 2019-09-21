const fs = require('fs');
const path = require('path');
const InfoExtract = require("../../infoextract");

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
  console.error("No config found! Things will break!", config_path);
}
require('dotenv').config({ path: config_path });

describe('InfoExtractor Spec', () => {
  it('should get the correct video metadata (uncached)', done => {
      InfoExtract.getVideoInfo("youtube", "BTZ5KVRUy1Q").then(video => {
        expect(video).toBeDefined();
        expect(video.service).toBeDefined();
        expect(video.service).toBe("youtube");
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
      });
  });
});
