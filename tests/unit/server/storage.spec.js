const _ = require("lodash");
const { CachedVideo } = require("../../../models");
const storage = require("../../../storage");
const { Room } = require("../../../models");
const permissions = require("../../../server/permissions.js");

describe('Storage: Room Spec', () => {
  beforeEach(async () => {
    await Room.destroy({ where: {} });
  });

  it('should return room object without extra properties', async () => {
    await storage.saveRoom({ name: "example", title: "Example Room", description: "This is an example room.", visibility: "public" });

    let room = await storage.getRoomByName("example");
    expect(room).not.toBeNull();
    expect(room).toBeDefined();
    expect(typeof room).toEqual("object");
    expect(room).not.toBeInstanceOf(Room);
    expect(room.id).toBeUndefined();
    expect(room.createdAt).toBeUndefined();
    expect(room.updatedAt).toBeUndefined();
    expect(_.pick(room, "name", "title", "description", "visibility", "owner")).toEqual({
      name: "example",
      title: "Example Room",
      description: "This is an example room.",
      visibility: "public",
      owner: null,
    });
    expect(room.permissions).toBeDefined();
    expect(typeof room.permissions).toEqual("object");
    expect(room.userRoles).toBeDefined();
    expect(typeof room.userRoles).toEqual("object");
  });

  it('should return room object from room name, case insensitive', async () => {
    await storage.saveRoom({ name: "CapitalizedExampleRoom", title: "Example Room", description: "This is an example room.", visibility: "public" });

    let room = await storage.getRoomByName("capitalizedexampleroom");
    expect(_.pick(room, "name", "title", "description", "visibility", "owner")).toEqual({
      name: "CapitalizedExampleRoom",
      title: "Example Room",
      description: "This is an example room.",
      visibility: "public",
      owner: null,
    });
  });

  it('should create room in database', async done => {
    expect(await Room.findOne({ where: { name: "example" }})).toBeNull();

    expect(await storage.saveRoom({ name: "example", title: "Example Room", description: "This is an example room.", visibility: "public" })).toBe(true);

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

  it('should not create room if name matches existing room, case insensitive', async () => {
    await storage.saveRoom({ name: "CapitalizedExampleRoom", visibility: "public" });

    expect(await storage.saveRoom({ name: "capitalizedexampleroom", visibility: "public" })).toBe(false);
  });

  it('should update the matching room in the database with the provided properties', async done => {
    expect(await Room.findOne({ where: { name: "example" }})).toBeNull();
    expect(await storage.saveRoom({ name: "example" })).toBe(true);

    expect(await storage.updateRoom({ name: "example", title: "Example Room", description: "This is an example room.", visibility: "unlisted" })).toBe(true);

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

  it('should fail to update if provided properties does not include name', () => {
    return expect(storage.updateRoom({ title: "Example Room", description: "This is an example room.", visibility: "unlisted" })).rejects.toThrow();
  });

  it('should return true if room name is taken', async () => {
    expect(await Room.findOne({ where: { name: "example" }})).toBeNull();
    expect(await storage.isRoomNameTaken("example")).toBe(false);
    expect(await storage.saveRoom({ name: "example" })).toBe(true);
    expect(await storage.isRoomNameTaken("example")).toBe(true);
  });

  it('should return true if room name is taken, case insensitive', async () => {
    await storage.saveRoom({ name: "Example" });
    expect(await storage.isRoomNameTaken("example")).toBe(true);
    expect(await storage.isRoomNameTaken("exAMple")).toBe(true);
  });

  it('should save and load permissions correctly', async () => {
    let perms = permissions.defaultPermissions();
    perms.masks[0] ^= permissions.parseIntoGrantMask(["playback"]);
    await storage.saveRoom({ name: "example", permissions: perms });

    let room = await storage.getRoomByName("example");
    expect(room.permissions).toEqual(perms);

    perms.masks[0] ^= permissions.parseIntoGrantMask(["manage-queue"]);
    await storage.updateRoom({ name: "example", permissions: perms });

    room = await storage.getRoomByName("example");
    expect(room.permissions).toEqual(perms);
  });

  it('should load permissions as an instance of Grants', async () => {
    await storage.saveRoom({ name: "example", permissions: new permissions.Grants() });

    let room = await storage.getRoomByName("example");
    expect(room.permissions).toBeInstanceOf(permissions.Grants);
    expect(room.permissions).toEqual(new permissions.Grants());
  });

  it('should save and load userRoles correctly', async () => {
    let userRoles = {
      // eslint-disable-next-line array-bracket-newline
      2: [1, 2, 3],
      3: [4],
      4: [8, 9],
    };
    await storage.saveRoom({ name: "example", userRoles });

    let room = await storage.getRoomByName("example");
    expect(room.userRoles).toEqual(userRoles);

    userRoles = {
      // eslint-disable-next-line array-bracket-newline
      2: [1, 3],
      3: [4, 7],
      4: [8],
    };
    await storage.updateRoom({ name: "example", userRoles });

    room = await storage.getRoomByName("example");
    expect(room.userRoles).toEqual(userRoles);
  });
});

describe('Storage: CachedVideos Spec', () => {
  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  it('should create or update cached video without failing', async () => {
    let video = {
      service: "youtube",
      id: "-29I-VbvPLQ",
      title: "tmp181mfK",
      description: "tmp181mfK",
      thumbnail: "https://i.ytimg.com/vi/-29I-VbvPLQ/mqdefault.jpg",
      length: 10,
    };
    expect(await storage.updateVideoInfo(video)).toBe(true);
  });

  it('should fail validation, no null allowed for service', async () => {
    let video = {
      service: null,
      id: "-29I-VbvPLQ",
      title: "tmp181mfK",
      description: "tmp181mfK",
      thumbnail: "https://i.ytimg.com/vi/-29I-VbvPLQ/mqdefault.jpg",
      length: 10,
    };
    expect(await storage.updateVideoInfo(video, false)).toBe(false);
  });

  it('should fail validation, no null allowed for serviceId', async () => {
    let video = {
      service: "youtube",
      id: null,
      title: "tmp181mfK",
      description: "tmp181mfK",
      thumbnail: "https://i.ytimg.com/vi/-29I-VbvPLQ/mqdefault.jpg",
      length: 10,
    };
    expect(await storage.updateVideoInfo(video, false)).toBe(false);
  });

  it('should return the attributes that a video object should have', () => {
    let attributes = storage.getVideoInfoFields();
    expect(attributes.length).toBeGreaterThan(0);
    expect(attributes).not.toContain("id");
    expect(attributes).not.toContain("service");
    expect(attributes).not.toContain("serviceId");
    expect(attributes).not.toContain("createdAt");
    expect(attributes).not.toContain("updatedAt");

    attributes = storage.getVideoInfoFields("youtube");
    expect(attributes).not.toContain("mime");
    attributes = storage.getVideoInfoFields("googledrive");
    expect(attributes).not.toContain("description");
  });

  it('should create or update multiple videos without failing', async () => {
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
    expect(await storage.updateManyVideoInfo(videos)).toBe(true);
  });

  it('should get multiple videos without failing', async () => {
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
    await CachedVideo.bulkCreate(_.cloneDeep(videos).map(video => {
      video.serviceId = video.id;
      delete video.id;
      return video;
    }));
    expect(await storage.getManyVideoInfo(videos)).toEqual(videos);
  });

  it('should return the same number of videos as requested even when some are not in the database', async () => {
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
      },
      {
        service: "fakeservice",
        id: "def456",
      },
    ];
    await CachedVideo.bulkCreate(_.cloneDeep(videos).splice(0, 3).map(video => {
      video.serviceId = video.id;
      delete video.id;
      return video;
    }));
    expect(await storage.getManyVideoInfo(videos)).toEqual(videos);
  });
});

describe('Storage: CachedVideos: bulk inserts/updates', () => {
  beforeEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  afterEach(async () => {
    await CachedVideo.destroy({ where: {} });
  });

  it('should create 2 entries and update 3 entries', async () => {
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
      await CachedVideo.create(video);
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
    expect(await storage.updateManyVideoInfo(videos)).toBe(true);

    expect(await storage.getVideoInfo("fakeservice", "abc123")).toEqual(videos[0]);
    expect(await storage.getVideoInfo("fakeservice", "abc456")).toEqual(videos[1]);
    expect(await storage.getVideoInfo("fakeservice", "abc789")).toEqual(videos[2]);
    expect(await storage.getVideoInfo("fakeservice", "def123")).toEqual(videos[3]);
    expect(await storage.getVideoInfo("fakeservice", "def456")).toEqual(videos[4]);
  });
});
