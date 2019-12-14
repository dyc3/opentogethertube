const fs = require('fs');
const path = require('path');
const roommanager = require("../../roommanager");
const InfoExtract = require("../../infoextract");
const storage = require("../../storage");
const moment = require("moment");

const configPath = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(configPath)) {
  console.error("No config found! Things will break!", configPath);
}
require('dotenv').config({ path: configPath });

describe('Room manager: Room tests', () => {
  beforeEach(done => {
    roommanager.rooms = [];
    roommanager.createRoom("test", true);
    roommanager.getLoadedRoom("test").then(room => {
      room.title = "Test Room";
      room.description = "This is a test room.";
      done();
    });
  });

  afterEach(done => {
    roommanager.getLoadedRoom("test").then(room => {
      roommanager.unloadRoom(room);
      done();
    });
  });

  it('should dequeue the next video in the queue, when there is no video playing', done => {
    roommanager.getLoadedRoom("test").then(room => {
      room.queue = [{ service: "youtube", id: "I3O9J02G67I", length: 10 }];
      room.update();

      expect(room.queue.length).toEqual(0);
      expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      done();
    });
  });

  it('should dequeue the next video in the queue, when the current video is done playing', done => {
    roommanager.getLoadedRoom("test").then(room => {
      room.queue = [{ service: "youtube", id: "I3O9J02G67I", length: 10 }];
      room.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };
      room.playbackPosition = 11;
      room.update();

      expect(room.queue.length).toEqual(0);
      expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      expect(room.playbackPosition).toEqual(0);
      done();
    });
  });

  it('should stop playing, when the current video is done playing and the queue is empty', done => {
    roommanager.getLoadedRoom("test").then(room => {
      room.queue = [];
      room.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };
      room.playbackPosition = 11;
      room.isPlaying = true;
      room.update();

      expect(room.queue.length).toEqual(0);
      expect(room.currentSource).toEqual({});
      expect(room.playbackPosition).toEqual(0);
      expect(room.isPlaying).toEqual(false);
      done();
    });
  });

  it('should add a video to the queue with url provided, and because no video is playing, move it into currentSource', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({ service: "youtube", id: "I3O9J02G67I", length: 10 })));
    roommanager.getLoadedRoom("test").then(room => {
      room.queue = [];

      expect(room.name).toBeDefined();
      expect(room.name.length).toBeGreaterThan(0);
      expect(room.queue.length).toEqual(0);
      expect(room.currentSource).toEqual({});

      expect(room.addToQueue({ url: "http://youtube.com/watch?v=I3O9J02G67I" })).resolves.toBe(true);

      expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
      expect(room.queue.length).toEqual(0);
      // Make sure that any async functions waiting have finished before checking currentSource
      setImmediate(() => {
        expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
        done();
      });
    });
  });

  it('should add a video to the queue with service and id provided, and because no video is playing, move it into currentSource', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({ service: "youtube", id: "I3O9J02G67I", length: 10 })));
    roommanager.getLoadedRoom("test").then(room => {
      room.queue = [];

      expect(room.name).toBeDefined();
      expect(room.name.length).toBeGreaterThan(0);
      expect(room.queue.length).toEqual(0);
      expect(room.currentSource).toEqual({});

      expect(room.addToQueue({ service: "youtube", id: "I3O9J02G67I" })).resolves.toBe(true);

      expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
      expect(room.queue.length).toEqual(0);
      // Make sure that any async functions waiting have finished before checking currentSource
      setImmediate(() => {
        expect(room.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
        done();
      });
    });
  });

  it('should add a video to the queue with service and id provided, and because a video is playing, leave it in the queue', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({ service: "youtube", id: "I3O9J02G67I", length: 10 })));
    roommanager.getLoadedRoom("test").then(room => {
      room.queue = [];
      room.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };

      expect(room.name).toBeDefined();
      expect(room.name.length).toBeGreaterThan(0);
      expect(room.queue.length).toEqual(0);

      expect(room.addToQueue({ service: "youtube", id: "I3O9J02G67I" })).resolves.toBe(true);

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
});

describe('Room manager: Manager tests', () => {
  beforeEach(done => {
    roommanager.rooms = [];
    done();
  });

  afterEach(done => {
    done();
  });

  it('should create a temporary room with the name "tmp"', done => {
    roommanager.createRoom('tmp', true);
    roommanager.getLoadedRoom('tmp').then(room => {
      expect(room).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual('tmp');
      expect(room.isTemporary).toEqual(true);
      expect(room.keepAlivePing).toBeDefined();
      done();
    });
  });

  it('should create a permanent room with the name "perm"', done => {
    storage.saveRoom = jest.fn();
    roommanager.createRoom('perm', false);
    roommanager.getLoadedRoom('perm').then(room => {
      expect(room).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual('perm');
      expect(room.isTemporary).toEqual(false);
      expect(room.keepAlivePing).toBe(null);
      expect(storage.saveRoom).toBeCalled();
      done();
    });
  });

  it('should load the room from the database', done => {
    storage.getRoomByName = jest.fn().mockReturnValue(new Promise(resolve => resolve({ name: "test", title: "Test Room", description: "This is a Test Room." })));
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
    storage.getRoomByName = jest.fn().mockReturnValue(new Promise(resolve => resolve({ name: "test", title: "Test Room", description: "This is a Test Room." })));
    roommanager.loadRoom("test").then(room => {
      expect(roommanager.rooms.length).toEqual(1);
      roommanager.unloadRoom(room);
      expect(roommanager.rooms.length).toEqual(0);
      done();
    }).catch(err => done.fail(err));
  });

  it('should unload a room with no active clients after 10 seconds', done => {
    storage.getRoomByName = jest.fn().mockReturnValue(new Promise(resolve => resolve({ name: "test", title: "Test Room", description: "This is a Test Room." })));
    roommanager.loadRoom("test").then((room) => {
      expect(roommanager.rooms.length).toEqual(1);
      room.keepAlivePing = moment().subtract(10, 'seconds');
      roommanager.unloadIfEmpty(room);
      expect(roommanager.rooms.length).toEqual(0);
    });
    done();
  });

  it('should not unload a room with no active clients after 9 seconds', done => {
    storage.getRoomByName = jest.fn().mockReturnValue(new Promise(resolve => resolve({ name: "test", title: "Test Room", description: "This is a Test Room." })));
    roommanager.loadRoom("test").then((room) => {
      expect(roommanager.rooms.length).toEqual(1);
      room.keepAlivePing = moment().subtract(9, 'seconds');
      roommanager.unloadIfEmpty(room);
      expect(roommanager.rooms.length).toEqual(1);
    });
    done();
  });

  it('should throw RoomNotFoundException when attempting to load a room that does not exist', done => {
    storage.getRoomByName = jest.fn().mockReturnValue(new Promise(resolve => resolve(null)));
    roommanager.loadRoom("test").then(() => {
      done.fail();
    }).catch(err => {
      expect(err.name).toEqual('RoomNotFoundException');
      done();
    });
  });

  it('should throw RoomAlreadyLoadedException when attempting to load a room that is already loaded', async done => {
    storage.getRoomByName = jest.fn().mockReturnValue(new Promise(resolve => resolve({ name: "test", title: "Test Room", description: "This is a Test Room." })));
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

  it('should throw RoomNameTakenException if a room with a given name already exists', () => {
    roommanager.createRoom("test", true);
    expect(roommanager.rooms).toHaveLength(1);
    try {
      roommanager.createRoom("test", true);
    }
    catch (err) {
      expect(err.name).toEqual("RoomNameTakenException");
    }
    expect(roommanager.rooms).toHaveLength(1);
  });
});
