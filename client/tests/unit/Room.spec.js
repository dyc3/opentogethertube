import Vue from "vue";
import { shallowMount, createLocalVue } from "@vue/test-utils";
import Vuex from "vuex";
import VueEvents from "vue-events";
import Vuetify from "vuetify";
import VueSlider from "vue-slider-component";
import Room from "@/views/Room";
import { i18n } from "@/i18n";

jest.useFakeTimers();

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();
localVue.use(Vuex);
localVue.use(VueEvents);
localVue.component("VueSlider", VueSlider);

const $route = {
	path: "http://localhost:8080/room/example",
	params: {
		roomId: "example",
	},
};

function createStore() {
	return new Vuex.Store({
		state: {
			socket: {
				isConnected: false,
				message: "",
				reconnectError: false,
			},
			joinFailureReason: null,
			production: true,
			room: {
				name: "example",
				title: "",
				description: "",
				isTemporary: false,
				currentSource: { length: 0 },
				queue: [],
				isPlaying: false,
				playbackPosition: 0,
				users: [],
				events: [],
			},
			users: {
				you: {
					grants: 0b1111111111111111111111111111111111111111,
				},
			},
		},
	});
}

function mountNewInstance(store) {
	return shallowMount(Room, {
		store,
		localVue,
		i18n,
		mocks: {
			$route,
			$connect: jest.fn(),
			$disconnect: jest.fn(),
			$socket: {
				sendObj: jest.fn(),
			},
		},
		stubs: ["youtube", "router-link"],
	});
}

describe.skip("Room UI spec", () => {
	let wrapper;
	let store;

	beforeEach(() => {
		store = createStore();
		wrapper = mountNewInstance(store);
	});

	afterEach(async () => {
		await wrapper.destroy();
	});

	it("should render room title in permanent rooms, if the room has one", () => {
		store.state.room.title = "Example Room";
		store.state.room.isTemporary = false;
		const roomTitle = wrapper.find("h1");
		expect(roomTitle.text()).toEqual("Example Room");
	});

	it("should render room name in permanent rooms, if the room has no title", () => {
		store.state.room.title = "";
		store.state.room.isTemporary = false;
		const roomTitle = wrapper.find("h1");
		expect(roomTitle.text()).toEqual("example");
	});

	it('should render "Temporary Room" in temporary rooms, if the room has no title', done => {
		store.state.room.title = "";
		store.state.room.isTemporary = true;
		const roomTitle = wrapper.find("h1");
		wrapper.vm.$nextTick(() => {
			expect(roomTitle.text()).toEqual("Temporary Room");
			done();
		});
	});

	it("should render timestamps as 00:00 if there is nothing playing", () => {
		store.state.room.currentSource = {};
		jest.advanceTimersByTime(1000);
		const timestamp = wrapper.find(".video-controls .timestamp");
		expect(timestamp.exists()).toBe(true);
		expect(timestamp.text()).toEqual("00:00");
		const videoLength = wrapper.find(".video-controls .video-length");
		expect(videoLength.exists()).toBe(true);
		expect(videoLength.text()).toEqual("00:00");
	});

	it("should render timestamps if there is something playing", () => {
		store.state.room.currentSource = { service: "youtube", id: "I3O9J02G67I", length: 10 };
		store.state.room.playbackPosition = 3;
		jest.advanceTimersByTime(1000);
		const timestamp = wrapper.find(".video-controls .timestamp");
		expect(timestamp.exists()).toBe(true);
		expect(timestamp.text()).toEqual("00:03");
		const videoLength = wrapper.find(".video-controls .video-length");
		expect(videoLength.exists()).toBe(true);
		expect(videoLength.text()).toEqual("00:10");
	});

	it("should render a disabled video slider if there is nothing playing", () => {
		store.state.room.currentSource = {};
		const videoSlider = wrapper.find("#videoSlider");
		expect(videoSlider.exists()).toBe(true);
		expect(videoSlider.attributes("disabled")).toBe("true");
	});

	it("should render an enabled video slider if there is something playing", () => {
		store.state.room.currentSource = { service: "youtube", id: "I3O9J02G67I", length: 10 };
		const videoSlider = wrapper.find("#videoSlider");
		expect(videoSlider.exists()).toBe(true);
		expect(videoSlider.attributes("disabled")).toBe(undefined);
	});

	it('should render "Connected" if connected', () => {
		store.state.socket.isConnected = true;
		const connectStatusElement = wrapper.find("#connectStatus");
		expect(connectStatusElement.exists()).toBe(true);
		expect(connectStatusElement.text()).toEqual("Connected");
	});

	it('should render "Connecting.." if not connected', () => {
		store.state.socket.isConnected = false;
		const connectStatusElement = wrapper.find("#connectStatus");
		expect(connectStatusElement.exists()).toBe(true);
		expect(connectStatusElement.text()).toEqual("Connecting...");
	});

	it("should render the number of videos queued", () => {
		store.state.room.queue = [];
		const queueCount = wrapper.find(".bubble");
		expect(queueCount.exists()).toBe(true);
		expect(queueCount.text()).toEqual("0");

		store.state.room.queue = [{}, {}, {}];
		expect(queueCount.text()).toEqual("3");
	});

	it("should render join failure overlay", () => {
		wrapper.setData({
			showJoinFailOverlay: true,
			joinFailReason: "Room does not exist",
		});
		const overlay = wrapper.find({ name: "v-overlay" });
		expect(overlay.exists()).toBe(true);
		expect(overlay.isVisible()).toBe(true);
		expect(overlay.find("span").text()).toEqual("Room does not exist");
	});

	it("should invite link be the page URL", () => {
		// FIXME: actually test the contents of the invite link
		expect(wrapper.vm.inviteLink).toEqual(window.location.href);
	});

	describe("Keyboard controls", () => {
		it("should toggle playback when space or k is pressed", async () => {
			store = createStore();
			wrapper = mountNewInstance(store);
			jest.spyOn(wrapper.vm, "togglePlayback").mockImplementation();

			// HACK: for some reason wrapper.trigger() is not working here
			wrapper.vm.onKeyDown({
				code: "Space",
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.togglePlayback).toHaveBeenCalledTimes(1);
			wrapper.vm.togglePlayback.mockClear();

			wrapper.vm.onKeyDown({
				code: "k",
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.togglePlayback).toHaveBeenCalledTimes(1);
			wrapper.vm.togglePlayback.mockClear();
		});

		it("should seek to beginning when home is pressed", async () => {
			store = createStore();
			wrapper = mountNewInstance(store);

			// HACK: for some reason wrapper.trigger() is not working here
			wrapper.vm.onKeyDown({
				code: "Home",
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.$socket.sendObj).toHaveBeenCalledWith({
				action: "seek",
				position: 0,
			});
		});

		it("should skip video when end is pressed", async () => {
			store = createStore();
			wrapper = mountNewInstance(store);

			// HACK: for some reason wrapper.trigger() is not working here
			wrapper.vm.onKeyDown({
				code: "End",
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.$socket.sendObj).toHaveBeenCalledWith({ action: "skip" });
		});

		it("should toggle fullscreen when f is pressed", async () => {
			store = createStore();
			wrapper = mountNewInstance(store);
			jest.spyOn(wrapper.vm, "toggleFullscreen").mockImplementation();

			// HACK: for some reason wrapper.trigger() is not working here
			wrapper.vm.onKeyDown({
				code: "KeyF",
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.toggleFullscreen).toHaveBeenCalledTimes(1);
		});

		it("should seek the correct amount", async () => {
			store = createStore();
			wrapper = mountNewInstance(store);
			jest.spyOn(wrapper.vm, "seekDelta").mockImplementation();

			// HACK: for some reason wrapper.trigger() is not working here
			wrapper.vm.onKeyDown({
				code: "ArrowRight",
				ctrlKey: false,
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.seekDelta).toHaveBeenCalledWith(5);
			wrapper.vm.seekDelta.mockClear();

			wrapper.vm.onKeyDown({
				code: "ArrowRight",
				ctrlKey: true,
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.seekDelta).toHaveBeenCalledWith(10);
			wrapper.vm.seekDelta.mockClear();

			wrapper.vm.onKeyDown({
				code: "ArrowLeft",
				ctrlKey: false,
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.seekDelta).toHaveBeenCalledWith(-5);
			wrapper.vm.seekDelta.mockClear();

			wrapper.vm.onKeyDown({
				code: "ArrowLeft",
				ctrlKey: true,
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.seekDelta).toHaveBeenCalledWith(-10);
			wrapper.vm.seekDelta.mockClear();

			wrapper.vm.onKeyDown({
				code: "KeyL",
				ctrlKey: false,
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.seekDelta).toHaveBeenCalledWith(10);
			wrapper.vm.seekDelta.mockClear();

			wrapper.vm.onKeyDown({
				code: "KeyJ",
				ctrlKey: false,
				target: { nodeName: "" },
				preventDefault: jest.fn(),
			});
			expect(wrapper.vm.seekDelta).toHaveBeenCalledWith(-10);
			wrapper.vm.seekDelta.mockClear();
		});

		it("should set the correct snackbar text", () => {
			store = createStore();
			wrapper = mountNewInstance(store);

			wrapper.vm.onRoomEvent({ eventType: "anything" });
			expect(wrapper.vm.snackbarActive).toEqual(true);

			wrapper.vm.onRoomEvent({ eventType: "play" });
			expect(wrapper.vm.snackbarText).toContain("played");

			wrapper.vm.onRoomEvent({ eventType: "pause" });
			expect(wrapper.vm.snackbarText).toContain("paused");

			wrapper.vm.onRoomEvent({ eventType: "skip", parameters: { video: {} } });
			expect(wrapper.vm.snackbarText).toContain("skipped");

			wrapper.vm.onRoomEvent({ eventType: "seek", parameters: { position: 0 } });
			expect(wrapper.vm.snackbarText).toContain("seeked");

			wrapper.vm.onRoomEvent({ eventType: "joinRoom" });
			expect(wrapper.vm.snackbarText).toContain("joined");

			wrapper.vm.onRoomEvent({ eventType: "leaveRoom" });
			expect(wrapper.vm.snackbarText).toContain("left");

			wrapper.vm.onRoomEvent({ eventType: "addToQueue", parameters: { video: {} } });
			expect(wrapper.vm.snackbarText).toContain("added");

			wrapper.vm.onRoomEvent({ eventType: "addToQueue", parameters: { count: 1 } });
			expect(wrapper.vm.snackbarText).toContain("added");

			wrapper.vm.onRoomEvent({ eventType: "removeFromQueue", parameters: { video: {} } });
			expect(wrapper.vm.snackbarText).toContain("removed");
		});

		it("should show the add tab", () => {
			store = createStore();
			wrapper = mountNewInstance(store);

			wrapper.vm.switchToAddTab();
			expect(wrapper.vm.queueTab).toEqual(1);
		});
	});

	it("should only send room settings that the client has permissions for", async () => {
		await wrapper.setData({
			inputRoomSettings: {
				title: "room title",
				description: "room description",
				visibility: "public",
				queueMode: "vote",
				permissions: { 0: 1 },
			},
		});
		let settings = wrapper.vm.getRoomSettingsSubmit();
		expect(Object.keys(settings)).toEqual([
			"title",
			"description",
			"visibility",
			"queueMode",
			"permissions",
		]);

		wrapper.vm.$store.state.users.you.grants = (1 << 8) | (1 << 9);
		settings = wrapper.vm.getRoomSettingsSubmit();
		expect(Object.keys(settings)).toEqual(["title", "description", "permissions"]);
	});
});
