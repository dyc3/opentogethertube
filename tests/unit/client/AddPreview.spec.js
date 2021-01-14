import Vue from 'vue';
import { shallowMount, createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import Vuetify from 'vuetify';
import AddPreview from "@/components/AddPreview.vue";
import VueEvents from 'vue-events';

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();
localVue.use(Vuex);
localVue.use(VueEvents);

function createStore() {
	return new Vuex.Store({
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
				currentSource: { length: 0 },
				queue: [],
				isPlaying: false,
				playbackPosition: 0,
				users: [],
				events: [],
			},
			quickAdd: [],
		},
	});
}

function mountNewInstance(store) {
	return shallowMount(AddPreview, {
		store,
		localVue,
		stubs: ['router-link'],
	});
}

describe("AddPreview", () => {
	let wrapper;
	let store;

	beforeEach(() => {
		store = createStore();
		wrapper = mountNewInstance(store);
	});

	afterEach(async () => {
		await wrapper.destroy();
	});

	it('should render test buttons when in dev environment', () => {
		store.state.production = false;
		const testVideoButtons = wrapper.find('.video-add').findAll({ name: 'v-btn' });
		expect(testVideoButtons.length).toBeGreaterThanOrEqual(1);
		expect(testVideoButtons.at(0).text()).toEqual('Add test youtube 0');
		expect(testVideoButtons.at(1).text()).toEqual('Add test youtube 1');
		expect(testVideoButtons.at(2).text()).toEqual('Add test vimeo 2');
	});

	it('should NOT render test buttons when in production environment', () => {
		store.state.production = true;
		const testVideoButtons = wrapper.find('.video-add').findAll({ name: 'v-btn' });
		expect(testVideoButtons.length).toEqual(0);
	});

	it('should determine if the add preview link is a URL', () => {
		jest.spyOn(wrapper.vm, 'requestAddPreviewDebounced').mockImplementation();

		wrapper.setData({ inputAddPreview: "https://example.com" });
		expect(wrapper.vm.isAddPreviewInputUrl).toEqual(true);

		wrapper.setData({ inputAddPreview: "pokimane feet compilation" });
		expect(wrapper.vm.isAddPreviewInputUrl).toEqual(false);
	});

	it('should request add previews when input is URL', () => {
		jest.spyOn(wrapper.vm, 'requestAddPreviewDebounced').mockImplementation();

		wrapper.setData({ inputAddPreview: "https://example.com" });
		expect(wrapper.vm.requestAddPreviewDebounced).toBeCalled();
		wrapper.vm.requestAddPreviewDebounced.mockClear();

		wrapper.setData({ inputAddPreview: "       " });
		expect(wrapper.vm.requestAddPreviewDebounced).not.toBeCalled();
		wrapper.vm.requestAddPreviewDebounced.mockClear();

		wrapper.setData({ inputAddPreview: "how to get smaller toes" });
		expect(wrapper.vm.requestAddPreviewDebounced).not.toBeCalled();
		wrapper.vm.requestAddPreviewDebounced.mockClear();
	});
});
