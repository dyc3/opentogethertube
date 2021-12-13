import Vue from 'vue';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import Notifier from "@/components/Notifier.vue";
import Vuex from 'vuex';
import { toastModule } from "@/stores/toast";

const localVue = createLocalVue();

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

import VueEvents from 'vue-events';
localVue.use(VueEvents);

localVue.use(Vuex);

function createStore() {
	return new Vuex.Store({
		modules: {
			toast: toastModule,
		},
	});
}

describe("Notifier component", () => {
	it("should render toast notifications", async () => {
		let wrapper = mount(Notifier, {
			localVue,
			store: createStore(),
			stubs: ['router-link', 'v-icon'],
		});

		wrapper.vm.$store.commit('toast/ADD_TOAST', { content: 'test' });
		await wrapper.vm.$nextTick();
		const toast = wrapper.find('.toast-item');
		expect(toast.exists()).toBe(true);
		expect(toast.text()).toContain('test');

		await wrapper.destroy();
	});
});
