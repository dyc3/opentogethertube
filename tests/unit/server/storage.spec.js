const fs = require('fs');
const path = require('path');
const { CachedVideo } = require("../../../models");
const storage = require("../../../storage");
const { Room } = require("../../../models");

const configPath = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(configPath)) {
  console.error("No config found! Things will break!", configPath);
}
require('dotenv').config({ path: configPath });

describe('Storage: Room Spec', () => {
  beforeEach(async () => {
    await Room.destroy({ where: {} });
  }),

  it('should return room object without extra properties', async done => {
    await storage.saveRoom({ name: "example", title: "Example Room", description: "This is an example room.", visibility: "public" });

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
      expect(room.visibility).toEqual("public");
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it('should create room in database', async done => {
    await expect(Room.findOne({ where: { name: "example" }})).resolves.toBeNull();

    await expect(storage.saveRoom({ name: "example", title: "Example Room", description: "This is an example room.", visibility: "public" })).resolves.toBe(true);

    Room.findOne({ where: { name: "example" }}).then(room => {
      expect(room).toBeInstanceOf(Room);
      expect(room.id).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual("example");
      expect(room.title).toBeDefined();
      expect(room.title).toEqual("Example Room");
      expect(room.description).toBeDefined();
      expect(room.description).toEqual("This is an example room.");
      expect(room.visibility).toEqual("public");
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it('should update the matching room in the database with the provided properties', async done => {
    await expect(Room.findOne({ where: { name: "example" }})).resolves.toBeNull();
    await expect(storage.saveRoom({ name: "example" })).resolves.toBe(true);

    await expect(storage.updateRoom({ name: "example", title: "Example Room", description: "This is an example room.", visibility: "unlisted" })).resolves.toBe(true);

    Room.findOne({ where: { name: "example" }}).then(room => {
      expect(room).toBeInstanceOf(Room);
      expect(room.id).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual("example");
      expect(room.title).toBeDefined();
      expect(room.title).toEqual("Example Room");
      expect(room.description).toBeDefined();
      expect(room.description).toEqual("This is an example room.");
      expect(room.visibility).toEqual("unlisted");
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it('should fail to update if provided properties does not include name', done => {
    storage.updateRoom({ title: "Example Room", description: "This is an example room.", visibility: "unlisted" }).then(() => {
      done.fail();
    }).catch(() => {
      done();
    });
  });

  it('should return true if room name is taken', async () => {
    await expect(Room.findOne({ where: { name: "example" }})).resolves.toBeNull();
    expect(await storage.isRoomNameTaken("example")).toBe(false);
    await expect(storage.saveRoom({ name: "example" })).resolves.toBe(true);
    expect(await storage.isRoomNameTaken("example")).toBe(true);
  });
});

describe('Storage: CachedVideos Spec', () => {
  afterAll(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  it('should create or update cached video without failing', done => {
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

  it('should fail validation, no null allowed for service', done => {
    let video = {
      service: null,
      id: "-29I-VbvPLQ",
      title: "tmp181mfK",
      description: "tmp181mfK",
      thumbnail: "https://i.ytimg.com/vi/-29I-VbvPLQ/mqdefault.jpg",
      length: 10,
    };
    expect(storage.updateVideoInfo(video, false)).resolves.toBe(false);
    done();
  });

  it('should fail validation, no null allowed for serviceId', done => {
    let video = {
      service: "youtube",
      id: null,
      title: "tmp181mfK",
      description: "tmp181mfK",
      thumbnail: "https://i.ytimg.com/vi/-29I-VbvPLQ/mqdefault.jpg",
      length: 10,
    };
    expect(storage.updateVideoInfo(video, false)).resolves.toBe(false);
    done();
  });

  it('should return the attributes that a video object should have', () => {
    let attributes = storage.getVideoInfoFields();
    expect(attributes.length).toBeGreaterThan(0);
    expect(attributes).not.toContain("id");
    expect(attributes).not.toContain("serviceId");
    expect(attributes).not.toContain("createdAt");
    expect(attributes).not.toContain("updatedAt");

    attributes = storage.getVideoInfoFields("youtube");
    expect(attributes).not.toContain("mime");
    attributes = storage.getVideoInfoFields("googledrive");
    expect(attributes).not.toContain("description");
  });

  it('should create or update multiple videos without failing', done => {
    let videos = [
      {
        service: "fakeservice",
        id: "abc123",
        title: "test video 1",
      },
      {
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
      },
      {
        service: "fakeservice",
        id: "abc789",
        title: "test video 3",
      },
      {
        service: "fakeservice",
        id: "def123",
        title: "test video 4",
      },
      {
        service: "fakeservice",
        id: "def456",
        title: "test video 5",
      },
    ];
    expect(storage.updateManyVideoInfo(videos)).resolves.toBe(true);
    done();
  });
});

describe('Storage: CachedVideos: bulk inserts/updates', () => {
  beforeEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  it('should create 2 entries and update 3 entries', async done => {
    // setup
    let existingVideos = [
      {
        service: "fakeservice",
        serviceId: "abc123",
        title: "existing video 1",
      },
      {
        service: "fakeservice",
        serviceId: "abc456",
        title: "existing video 2",
      },
      {
        service: "fakeservice",
        serviceId: "abc789",
        title: "existing video 3",
      },
    ];
    for (let video of existingVideos) {
      try {
        await CachedVideo.create(video);
      }
      catch (err) {
        done.fail(err);
      }
    }

    // test
    let videos = [
      {
        service: "fakeservice",
        id: "abc123",
        title: "test video 1",
      },
      {
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
      },
      {
        service: "fakeservice",
        id: "abc789",
        title: "test video 3",
      },
      {
        service: "fakeservice",
        id: "def123",
        title: "test video 4",
      },
      {
        service: "fakeservice",
        id: "def456",
        title: "test video 5",
      },
    ];
    expect(storage.updateManyVideoInfo(videos)).resolves.toBe(true);

    expect(storage.getVideoInfo("fakeservice", "abc123")).resolves.toEqual(videos[0]);
    expect(storage.getVideoInfo("fakeservice", "abc456")).resolves.toEqual(videos[1]);
    expect(storage.getVideoInfo("fakeservice", "abc789")).resolves.toEqual(videos[2]);
    expect(storage.getVideoInfo("fakeservice", "def123")).resolves.toEqual(videos[3]);
    expect(storage.getVideoInfo("fakeservice", "def456")).resolves.toEqual(videos[4]);
    done();
  });
});
