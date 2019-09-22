const fs = require('fs');
const path = require('path');
const storage = require("../../storage");

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
  console.error("No config found! Things will break!", config_path);
}
require('dotenv').config({ path: config_path });

describe('Storage Spec', () => {
  it('should create or update cached video', done => {
    let video = {
      service: "youtube",
      id: "-29I-VbvPLQ",
      title: "tmp181mfK",
      description: "tmp181mfK",
      thumbnail: "https://i.ytimg.com/vi/-29I-VbvPLQ/mqdefault.jpg",
      length: 10,
    };
    expect(storage.updateVideoInfo(video)).resolves.toBe(true);
    done();
  });

  it('should return the attributes that a video object should have', () => {
    let attributes = storage.getVideoInfoFields();
    expect(attributes.length).toBeGreaterThan(0);
    expect(attributes).not.toContain("id");
    expect(attributes).not.toContain("serviceId");
    expect(attributes).not.toContain("createdAt");
    expect(attributes).not.toContain("updatedAt");
  });
});
