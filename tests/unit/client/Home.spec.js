import Vue from 'vue';
import { shallowMount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import Home from "@/views/Home.vue";

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();

describe("Home view", () => {
	let vuetify;

	beforeEach(() => {
		vuetify = new Vuetify();
	});

	it("should render without failing", () => {
		shallowMount(Home, {
			localVue,
			vuetify,
		});
	});
});
