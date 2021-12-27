import Vue from 'vue';
import { shallowMount, createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import Vuetify from 'vuetify';
import QuickRoom from "@/views/QuickRoom.vue";
import VueEvents from 'vue-events';

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();
localVue.use(Vuex);
localVue.use(VueEvents);

const $route = {
	path: 'http://localhost:8080/quickroom',
};

describe("Home view", () => {
	let wrapper;
	let state;
	let store;
	let mutations;

	beforeEach(() => {
		state = {
			quickAdd: [],
		};

		mutations = {
			QUICKADD_ADD: jest.fn(),
		};

		store = new Vuex.Store({
			state,
			mutations,
		});
	});

	afterEach(async () => {
		await wrapper.destroy();
	});

	it("should add video to quickadd", () => {
		delete global.window.location;
		global.window = Object.create(window);
		global.window.location = {
			search: "?service=fakeservice&id=test",
		};
		wrapper = shallowMount(QuickRoom, {
			store,
			localVue,
			mocks: {
				$route,
				$connect: jest.fn(),
				$disconnect: jest.fn(),
			},
			stubs: [
				'youtube',
				'router-link',
			],
		});

		expect(mutations.QUICKADD_ADD).toHaveBeenCalledWith(state, {
			service: "fakeservice",
			id: "test",
		});
	});
});
