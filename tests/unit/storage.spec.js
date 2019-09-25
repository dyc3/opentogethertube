const fs = require('fs');
const path = require('path');
const storage = require("../../storage");
const { Room } = require("../../models");

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
  console.error("No config found! Things will break!", config_path);
}
require('dotenv').config({ path: config_path });

describe('Storage: Room Spec', () => {
  beforeEach(async () => {
    await Room.destroy({ where: {} });
  }),

  it('should return room object without extra properties', async done => {
    await storage.saveRoom({ name: "example", title: "Example Room", description: "This is an example room." });

    storage.getRoomByName("example").then(room => {
      expect(room).not.toBeNull();
      expect(room).toBeDefined();
      expect(typeof room).toEqual("object");
      expect(room).not.toBeInstanceOf(Room);
      expect(room.id).toBeUndefined();
      expect(room.createdAt).toBeUndefined();
      expect(room.updatedAt).toBeUndefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual("example");
      expect(room.title).toBeDefined();
      expect(room.title).toEqual("Example Room");
      expect(room.description).toBeDefined();
      expect(room.description).toEqual("This is an example room.");
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it('should create room in database', async done => {
    await expect(Room.findOne({ where: { name: "example" }})).resolves.toBeNull();

    await expect(storage.saveRoom({ name: "example", title: "Example Room", description: "This is an example room." })).resolves.toBe(true);

    Room.findOne({ where: { name: "example" }}).then(room => {
      expect(room).toBeInstanceOf(Room);
      expect(room.id).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual("example");
      expect(room.title).toBeDefined();
      expect(room.title).toEqual("Example Room");
      expect(room.description).toBeDefined();
      expect(room.description).toEqual("This is an example room.");
      done();
    }).catch(err => {
      done.fail(err);
    });
  });
});

describe('Storage: CachedVideos Spec', () => {
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
