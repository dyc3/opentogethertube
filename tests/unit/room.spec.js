import Vue from 'vue';
import { shallowMount, createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import VueEvents from 'vue-events';
import Vuetify from 'vuetify';
import VueSlider from 'vue-slider-component';
import Room from '@/views/Room';

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();
localVue.use(Vuex);
localVue.use(VueEvents);
localVue.component('VueSlider', VueSlider);

const $route = {
  path: 'http://localhost:8080/room/example',
  params: {
    roomId: 'example',
  },
};

describe('Room UI spec', () => {
  let wrapper;
  let store;

  beforeEach(() => {
    store = new Vuex.Store({
      state: {
        socket: {
          isConnected: false,
          message: '',
          reconnectError: false,
        },
        joinFailureReason: null,
        production: true,
        room: {
          name: "example",
          title: "",
          description: "",
          isTemporary: false,
          currentSource: {},
          queue: [],
          isPlaying: false,
          playbackPosition: 0,
        },
      },
    });

    wrapper = shallowMount(Room, {
      store,
      localVue,
      mocks: {
        $route,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
      stubs: ['youtube'],
    });
  });

  it('should render room title in permanent rooms, if the room has one', () => {
    store.state.room.title = 'Example Room';
    store.state.room.isTemporary = false;
    const roomTitle = wrapper.find('h1');
    expect(roomTitle.text()).toEqual('Example Room');
  });

  it('should render room name in permanent rooms, if the room has no title', () => {
    store.state.room.title = '';
    store.state.room.isTemporary = false;
    const roomTitle = wrapper.find('h1');
    expect(roomTitle.text()).toEqual('example');
  });

  it('should render "Temporary Room" in temporary rooms, if the room has no title', done => {
    store.state.room.title = '';
    store.state.room.isTemporary = true;
    const roomTitle = wrapper.find('h1');
    wrapper.vm.$nextTick(() => {
      expect(roomTitle.text()).toEqual('Temporary Room');
      done();
    });
  });

  it('should render timestamps as 00:00 if there is nothing playing', () => {
    store.state.room.currentSource = {};
    const timestamp = wrapper.find('.video-controls .timestamp');
    expect(timestamp.exists()).toBe(true);
    expect(timestamp.text()).toEqual('00:00 / 00:00');
  });

  it('should render timestamps if there is something playing', () => {
    store.state.room.currentSource = { service: "youtube", id: "I3O9J02G67I", length: 10 };
    store.state.room.playbackPosition = 3;
    const timestamp = wrapper.find('.video-controls .timestamp');
    expect(timestamp.exists()).toBe(true);
    expect(timestamp.text()).toEqual('00:03 / 00:10');
  });

  it('should render a disabled video slider if there is nothing playing', () => {
    store.state.room.currentSource = {};
    const videoSlider = wrapper.find('#videoSlider');
    expect(videoSlider.exists()).toBe(true);
    expect(videoSlider.attributes('disabled')).toBe("true");
  });

  it('should render an enabled video slider if there is something playing', () => {
    store.state.room.currentSource = { service: "youtube", id: "I3O9J02G67I", length: 10 };
    const videoSlider = wrapper.find('#videoSlider');
    expect(videoSlider.exists()).toBe(true);
    expect(videoSlider.attributes('disabled')).toBe(undefined);
  });

  it('should render "Connected" if connected', () => {
    store.state.socket.isConnected = true;
    const connectStatusElement = wrapper.find('#connectStatus');
    expect(connectStatusElement.exists()).toBe(true);
    expect(connectStatusElement.text()).toEqual('Connected');
  });

  it('should render "Connecting.." if not connected', () => {
    store.state.socket.isConnected = false;
    const connectStatusElement = wrapper.find('#connectStatus');
    expect(connectStatusElement.exists()).toBe(true);
    expect(connectStatusElement.text()).toEqual('Connecting...');
  });

  it('should render the number of videos queued', () => {
    store.state.room.queue = [];
    const queueCount = wrapper.find('.bubble');
    expect(queueCount.exists()).toBe(true);
    expect(queueCount.text()).toEqual('0');

    store.state.room.queue = [
      {},
      {},
      {},
    ];
    expect(queueCount.text()).toEqual('3');
  });

  it('should render test buttons when in dev environment', () => {
    store.state.production = false;
    const testVideoButtons = wrapper.find('.video-add').findAll({ name: 'v-btn' });
    expect(testVideoButtons.length).toEqual(2);
    expect(testVideoButtons.at(0).text()).toEqual('Add test video 0');
    expect(testVideoButtons.at(1).text()).toEqual('Add test video 1');
  });

  it('should NOT render test buttons when in production environment', () => {
    store.state.production = true;
    const testVideoButtons = wrapper.find('.video-add').findAll({ name: 'v-btn' });
    expect(testVideoButtons.length).toEqual(0);
  });

  it('should render join failure overlay', () => {
    wrapper.setData({
      showJoinFailOverlay: true,
      joinFailReason: 'Room does not exist',
    });
    const overlay = wrapper.find({ name: 'v-overlay' });
    expect(overlay.exists()).toBe(true);
    expect(overlay.isVisible()).toBe(true);
    expect(overlay.find('span').text()).toEqual('Room does not exist');
  });
});
