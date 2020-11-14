const { RoomEvent, ROOM_EVENT_TYPE, ...roommanager } = require("../../../roommanager");
const InfoExtract = require("../../../server/infoextractor");
const storage = require("../../../storage");
const moment = require("moment");
const Video = require("../../../common/video.js");
const { Room } = require("../../../models");

describe('Room manager: Room tests', () => {
  beforeEach(async done => {
    roommanager.rooms = [];
    await Room.destroy({ where: {} });
    await roommanager.createRoom("test", true);
    roommanager.getLoadedRoom("test").then(room => {
      room.title = "Test Room";
      room.description = "This is a test room.";
      done();
    });
  });

  afterEach(async () => {
    await roommanager.unloadRoom("test");
    await Room.destroy({ where: {} });
  });

  it('should dequeue the next video in the queue, when there is no video playing', async () => {
    let room = await roommanager.getLoadedRoom("test");
    room.queue = [{ service: "youtube", id: "I3O9J02G67I", length: 10 }];
    room.update();

    expect(room.queue.length).toEqual(0);
    expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
  });

  it('should dequeue the next video in the queue, when the current video is done playing', async () => {
    let room = await roommanager.getLoadedRoom("test");
    room.queue = [{ service: "youtube", id: "I3O9J02G67I", length: 10 }];
    room.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };
    room.playbackPosition = 11;
    room.playbackStartTime = moment();
    room.update();

    expect(room.queue.length).toEqual(0);
    expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
    expect(room.playbackPosition).toEqual(0);
  });

  it('should stop playing, when the current video is done playing and the queue is empty', async () => {
    let room = await roommanager.getLoadedRoom("test");
    room.queue = [];
    room.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };
    room.playbackPosition = 11;
    room.isPlaying = true;
    room.playbackStartTime = moment();
    room.update();

    expect(room.queue.length).toEqual(0);
    expect(room.currentSource).toEqual({});
    expect(room.playbackPosition).toEqual(0);
    expect(room.isPlaying).toEqual(false);
  });

  it('should add a video to the queue with url provided, and because no video is playing, move it into currentSource', async done => {
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue({ service: "youtube", id: "I3O9J02G67I", length: 10 });
    let room = await roommanager.getLoadedRoom("test");
    room.queue = [];

    expect(room.name).toBeDefined();
    expect(room.name.length).toBeGreaterThan(0);
    expect(room.queue.length).toEqual(0);
    expect(room.currentSource).toEqual({});

    expect(await room.addToQueue({ url: "http://youtube.com/watch?v=I3O9J02G67I" })).toBe(true);

    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
    expect(room.queue.length).toEqual(0);
    // Make sure that any async functions waiting have finished before checking currentSource
    setImmediate(() => {
      expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      done();
    });
  });

  it('should add a video to the queue with service and id provided, and because no video is playing, move it into currentSource', async done => {
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue({ service: "youtube", id: "I3O9J02G67I", length: 10 });
    let room = await roommanager.getLoadedRoom("test");
    room.queue = [];

    expect(room.name).toBeDefined();
    expect(room.name.length).toBeGreaterThan(0);
    expect(room.queue.length).toEqual(0);
    expect(room.currentSource).toEqual({});

    expect(await room.addToQueue({ service: "youtube", id: "I3O9J02G67I" })).toBe(true);

    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
    expect(room.queue.length).toEqual(0);
    // Make sure that any async functions waiting have finished before checking currentSource
    setImmediate(() => {
      expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      done();
    });
  });

  it('should add a video to the queue with service and id provided, and because a video is playing, leave it in the queue', async done => {
    jest.spyOn(InfoExtract, 'getVideoInfo').mockImplementation().mockResolvedValue({ service: "youtube", id: "I3O9J02G67I", length: 10 });
    await roommanager.getLoadedRoom("test").then(async room => {
      room.queue = [];
      room.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };

      expect(room.name).toBeDefined();
      expect(room.name.length).toBeGreaterThan(0);
      expect(room.queue.length).toEqual(0);

      expect(await room.addToQueue({ service: "youtube", id: "I3O9J02G67I" })).toBe(true);

      expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
      // Make sure that any async functions waiting have finished before checking currentSource
      setImmediate(() => {
        expect(room.queue.length).toEqual(1);
        expect(room.queue[0]).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
        expect(room.currentSource).toEqual({ service: "youtube", id: "BTZ5KVRUy1Q", length: 10 });
        done();
      });
    });
  });

  it('should calculate correct playback position based on commitRoomEvent', async () => {
    let room = await roommanager.getLoadedRoom("test");
    jest.spyOn(room, "sync").mockImplementation();
    room.currentSource = { service: "fakeservice", id: "abc123", length: 200 };
    room.playbackPosition = 0;
    let now = moment("2020-01-01T06:00:00");

    room.commitRoomEvent(new RoomEvent(room.name, ROOM_EVENT_TYPE.PLAY, "user", {}), now);

    expect(room.isPlaying).toEqual(true);
    expect(room.playbackStartTime).toEqual(now);
    expect(room.playbackPosition).toEqual(0);

    now.add(5, "seconds");
    room.commitRoomEvent(new RoomEvent(room.name, ROOM_EVENT_TYPE.PAUSE, "user", {}), now);

    expect(room.isPlaying).toEqual(false);
    expect(room.playbackStartTime).not.toEqual(now);
    expect(room.playbackPosition).toEqual(5);

    now.add(10, "seconds");
    room.commitRoomEvent(new RoomEvent(room.name, ROOM_EVENT_TYPE.SEEK, "user", { position: 50 }), now);

    expect(room.isPlaying).toEqual(false);
    expect(room.playbackStartTime).toEqual(now);
    expect(room.playbackPosition).toEqual(50);

    // undo seek forwards
    let undoable = new RoomEvent(room.name, ROOM_EVENT_TYPE.SEEK, "user", { position: 100 });
    room.commitRoomEvent(undoable, now);
    expect(room.playbackPosition).toEqual(100);
    expect(undoable.parameters.previousPosition).toEqual(50);
    now.add(5, "seconds");
    room.undoEvent(undoable, now);

    expect(room.isPlaying).toEqual(false);
    expect(room.playbackStartTime).toEqual(now);
    expect(room.playbackPosition).toEqual(50);

    // undo seek backwards
    undoable = new RoomEvent(room.name, ROOM_EVENT_TYPE.SEEK, "user", { position: 20 });
    room.commitRoomEvent(undoable, now);
    expect(room.playbackPosition).toEqual(20);
    expect(undoable.parameters.previousPosition).toEqual(50);
    now.add(5, "seconds");
    room.undoEvent(undoable, now);

    expect(room.isPlaying).toEqual(false);
    expect(room.playbackStartTime).toEqual(now);
    expect(room.playbackPosition).toEqual(50);

    room.sync.mockReset();
  });
});

describe('Room manager: Manager tests', () => {
  beforeEach(async done => {
    await Room.destroy({ where: {} });
    roommanager.rooms = [];
    done();
  });

  afterEach(async () => {
    await Room.destroy({ where: {} });
  });

  it('should create a temporary room with the name "tmp"', async done => {
    await roommanager.createRoom('tmp', true);
    roommanager.getLoadedRoom('tmp').then(room => {
      expect(room).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual('tmp');
      expect(room.isTemporary).toEqual(true);
      expect(room.keepAlivePing).toBeDefined();
      done();
    });
  });

  it('should create a permanent room with the name "perm"', async () => {
    jest.spyOn(storage, 'saveRoom').mockImplementation();
    await roommanager.createRoom('perm', false);
    let room = await roommanager.getLoadedRoom('perm');
    expect(room).toBeDefined();
    expect(room.name).toBeDefined();
    expect(room.name).toEqual('perm');
    expect(room.isTemporary).toEqual(false);
    expect(room.keepAlivePing).toBe(null);
    expect(storage.saveRoom).toBeCalled();
  });

  it('should load the room from the database', done => {
    jest.spyOn(storage, 'getRoomByName').mockImplementation().mockResolvedValue({ name: "test", title: "Test Room", description: "This is a Test Room." });
    expect(roommanager.rooms.length).toEqual(0);
    roommanager.loadRoom("test").then(room => {
      expect(storage.getRoomByName).toBeCalled();
      expect(room).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual("test");
      expect(room.title).toBeDefined();
      expect(room.title).toEqual("Test Room");
      expect(room.description).toBeDefined();
      expect(room.description).toEqual("This is a Test Room.");
      expect(roommanager.rooms.length).toEqual(1);
      done();
    }).catch(err => done.fail(err));
  });

  it('should unload the room from memory', done => {
    jest.spyOn(storage, 'getRoomByName').mockImplementation().mockResolvedValue({ name: "test", title: "Test Room", description: "This is a Test Room." });
    roommanager.loadRoom("test").then(room => {
      expect(roommanager.rooms.length).toEqual(1);
      roommanager.unloadRoom(room);
      expect(roommanager.rooms.length).toEqual(0);
      done();
    }).catch(err => done.fail(err));
  });

  it('should unload a room with no active clients after 240 seconds', done => {
    jest.spyOn(storage, 'getRoomByName').mockImplementation().mockResolvedValue({ name: "test", title: "Test Room", description: "This is a Test Room." });
    roommanager.loadRoom("test").then((room) => {
      expect(roommanager.rooms.length).toEqual(1);
      room.keepAlivePing = moment().subtract(241, 'seconds');
      roommanager.unloadIfEmpty(room);
      expect(roommanager.rooms.length).toEqual(0);
    });
    done();
  });

  it('should not unload a room with no active clients after 9 seconds', done => {
    jest.spyOn(storage, 'getRoomByName').mockImplementation().mockResolvedValue({ name: "test", title: "Test Room", description: "This is a Test Room." });
    roommanager.loadRoom("test").then((room) => {
      expect(roommanager.rooms.length).toEqual(1);
      room.keepAlivePing = moment().subtract(9, 'seconds');
      roommanager.unloadIfEmpty(room);
      expect(roommanager.rooms.length).toEqual(1);
    });
    done();
  });

  it('should throw RoomNotFoundException when attempting to load a room that does not exist', done => {
    jest.spyOn(storage, 'getRoomByName').mockImplementation().mockResolvedValue(null);
    roommanager.loadRoom("test").then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).toEqual('RoomNotFoundException');
      done();
    });
  });

  it('should throw RoomAlreadyLoadedException when attempting to load a room that is already loaded', async done => {
    jest.spyOn(storage, 'getRoomByName').mockImplementation().mockResolvedValue({ name: "test", title: "Test Room", description: "This is a Test Room." });
    await roommanager.loadRoom("test");
    try {
      roommanager.loadRoom("test").then(() => {
        done.fail();
      });
    }
    catch (err) {
      expect(err.name).toEqual("RoomAlreadyLoadedException");
      done();
    }
  });

  it('should throw RoomNameTakenException if a room with a given name already exists', async () => {
    await roommanager.createRoom("test", true);
    expect(roommanager.rooms).toHaveLength(1);
    try {
      await roommanager.createRoom("test", true);
    }
    catch (err) {
      expect(err.name).toEqual("RoomNameTakenException");
    }
    expect(roommanager.rooms).toHaveLength(1);
  });
});

describe('Room manager: Undoable Events', () => {
  beforeEach(async () => {
    roommanager.rooms = [];
    await Room.destroy({ where: {} });
  });

  it('should revert seek event', async () => {
    await roommanager.createRoom("test", true);
    let testRoom = roommanager.rooms[0];
    testRoom.currentSource = new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    });
    testRoom.playbackPosition = 20;

    testRoom.undoEvent({
      eventType: "seek",
      parameters: {
        position: 20,
        previousPosition: 10,
      },
    });

    expect(testRoom.playbackPosition).toEqual(10);
  });

  it('should revert skip event with no videos in the queue and no video playing', async () => {
    await roommanager.createRoom("test", true);
    let testRoom = roommanager.rooms[0];

    testRoom.undoEvent({
      eventType: "skip",
      parameters: {
        video: new Video({
          service: "fakeservice",
          id: "abc123",
          title: "test video",
          length: 30,
        }),
      },
    });

    expect(testRoom.currentSource).toEqual(new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    }));
    expect(testRoom.playbackPosition).toEqual(0);
  });

  it('should revert skip event with no videos in the queue and with a video playing', async () => {
    await roommanager.createRoom("test", true);
    let testRoom = roommanager.rooms[0];
    testRoom.currentSource = new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    });
    testRoom.playbackPosition = 10;

    testRoom.undoEvent({
      eventType: "skip",
      parameters: {
        video: new Video({
          service: "fakeservice",
          id: "skipped",
          title: "skipped video",
          length: 30,
        }),
      },
    });

    expect(testRoom.currentSource).toEqual(new Video({
      service: "fakeservice",
      id: "skipped",
      title: "skipped video",
      length: 30,
    }));
    expect(testRoom.queue[0]).toEqual(new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    }));
    expect(testRoom.playbackPosition).toEqual(0);
  });

  it('should revert skip event with one video in the queue and with a video playing', async () => {
    await roommanager.createRoom("test", true);
    let testRoom = roommanager.rooms[0];
    testRoom.currentSource = new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    });
    testRoom.playbackPosition = 10;
    testRoom.queue = [
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
    ];

    testRoom.undoEvent({
      eventType: "skip",
      parameters: {
        video: new Video({
          service: "fakeservice",
          id: "skipped",
          title: "skipped video",
          length: 30,
        }),
      },
    });

    expect(testRoom.currentSource).toEqual(new Video({
      service: "fakeservice",
      id: "skipped",
      title: "skipped video",
      length: 30,
    }));
    expect(testRoom.queue).toHaveLength(2);
    expect(testRoom.queue[0]).toEqual(new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    }));
    expect(testRoom.playbackPosition).toEqual(0);
  });

  it('should revert removeFromQueue event with videos in the queue and with a video playing', async () => {
    await roommanager.createRoom("test", true);
    let testRoom = roommanager.rooms[0];
    testRoom.currentSource = new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    });
    testRoom.playbackPosition = 10;
    testRoom.queue = [
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
      new Video({
        service: "fakeservice",
        id: "abc456",
        title: "test video 2",
        length: 30,
      }),
    ];

    testRoom.undoEvent({
      eventType: "removeFromQueue",
      parameters: {
        video: new Video({
          service: "fakeservice",
          id: "removed",
          title: "removed video",
          length: 30,
        }),
        queueIdx: 2,
      },
    });

    expect(testRoom.currentSource).toEqual(new Video({
      service: "fakeservice",
      id: "abc123",
      title: "test video",
      length: 30,
    }));
    expect(testRoom.queue).toHaveLength(7);
    expect(testRoom.queue[2]).toEqual(new Video({
      service: "fakeservice",
      id: "removed",
      title: "removed video",
      length: 30,
    }));
    expect(testRoom.queue[3]).not.toBeInstanceOf(Array);
    expect(testRoom.queue[6]).toEqual(new Video({
      service: "fakeservice",
      id: "abc456",
      title: "test video 2",
      length: 30,
    }));
    expect(testRoom.playbackPosition).toEqual(10);
  });
});
