const fs = require('fs');
const path = require('path');
const roommanager = require("../../roommanager");
const InfoExtract = require("../../infoextract");

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

  it('should create a temporary room with the name "tmp"', done => {
    roommanager.createRoom('tmp', true);
    roommanager.getLoadedRoom('tmp').then(room => {
      expect(room).toBeDefined();
      expect(room.name).toBeDefined();
      expect(room.name).toEqual("tmp");
      expect(room.isTemporary).toEqual(true);
      expect(room.keepAlivePing).toBeDefined();
      done();
    });
  });
});
