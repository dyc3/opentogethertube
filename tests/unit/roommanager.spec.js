const fs = require('fs');
const path = require('path');
const roommanager = require("../../roommanager")({ on() {} }, require("../../storage"));
const InfoExtract = require("../../infoextract");

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
  console.error("No config found! Things will break!", config_path);
}
require('dotenv').config({ path: config_path });

describe('Room manager: Room tests', () => {
  beforeEach(() => {
    roommanager.rooms.test = {
      name: "test",
      title: "Test Room",
      description: "This is a test room.",
      isTemporary: false,
      currentSource: {},
      queue: [],
      clients: [],
      isPlaying: false,
      playbackPosition: 0,
    };
  });

  it('should add a video to the queue with url provided, and because no video is playing, move it into currentSource', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({ service: "youtube", id: "I3O9J02G67I", length: 10 })));
    expect(roommanager.rooms).toBeDefined();
    expect(roommanager.rooms.test).toBeDefined();
    expect(roommanager.rooms.test.name).toBeDefined();
    expect(roommanager.rooms.test.name.length).toBeGreaterThan(0);
    expect(roommanager.rooms.test.queue.length).toEqual(0);
    expect(roommanager.rooms.test.currentSource).toEqual({});

    expect(roommanager.addToQueue(roommanager.rooms.test.name, { url: "http://youtube.com/watch?v=I3O9J02G67I" })).resolves.toBe(true);

    expect(roommanager.rooms.test).toBeDefined();
    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
    expect(roommanager.rooms.test.queue.length).toEqual(0);
    // Make sure that any async functions waiting have finished before checking currentSource
    setImmediate(() => {
      expect(roommanager.rooms.test.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      done();
    });
  });

  it('should add a video to the queue with service and id provided, and because no video is playing, move it into currentSource', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({ service: "youtube", id: "I3O9J02G67I", length: 10 })));
    expect(roommanager.rooms).toBeDefined();
    expect(roommanager.rooms.test).toBeDefined();
    expect(roommanager.rooms.test.name).toBeDefined();
    expect(roommanager.rooms.test.name.length).toBeGreaterThan(0);
    expect(roommanager.rooms.test.queue.length).toEqual(0);
    expect(roommanager.rooms.test.currentSource).toEqual({});

    expect(roommanager.addToQueue(roommanager.rooms.test.name, { service: "youtube", id: "I3O9J02G67I" })).resolves.toBe(true);

    expect(roommanager.rooms.test).toBeDefined();
    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
    expect(roommanager.rooms.test.queue.length).toEqual(0);
    // Make sure that any async functions waiting have finished before checking currentSource
    setImmediate(() => {
      expect(roommanager.rooms.test.currentSource).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      done();
    });
  });

  it('should add a video to the queue with service and id provided, and because a video is playing, leave it in the queue', done => {
    InfoExtract.getVideoInfo = jest.fn().mockReturnValue(new Promise(resolve => resolve({ service: "youtube", id: "I3O9J02G67I", length: 10 })));
    expect(roommanager.rooms).toBeDefined();
    expect(roommanager.rooms.test).toBeDefined();
    expect(roommanager.rooms.test.name).toBeDefined();
    expect(roommanager.rooms.test.name.length).toBeGreaterThan(0);
    expect(roommanager.rooms.test.queue.length).toEqual(0);
    roommanager.rooms.test.currentSource = { service: "youtube", id: "BTZ5KVRUy1Q", length: 10 };

    expect(roommanager.addToQueue(roommanager.rooms.test.name, { service: "youtube", id: "I3O9J02G67I" })).resolves.toBe(true);

    expect(roommanager.rooms.test).toBeDefined();
    expect(InfoExtract.getVideoInfo).toBeCalledWith("youtube", "I3O9J02G67I");
    // Make sure that any async functions waiting have finished before checking currentSource
    setImmediate(() => {
      expect(roommanager.rooms.test.queue.length).toEqual(1);
      expect(roommanager.rooms.test.queue[0]).toEqual({ service: "youtube", id: "I3O9J02G67I", length: 10 });
      expect(roommanager.rooms.test.currentSource).toEqual({ service: "youtube", id: "BTZ5KVRUy1Q", length: 10 });
      done();
    });
  });
});
