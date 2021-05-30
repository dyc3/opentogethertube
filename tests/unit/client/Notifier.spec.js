import Vue from 'vue';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import Notifier from "@/components/Notifier.vue";

const localVue = createLocalVue();

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

import VueEvents from 'vue-events';
localVue.use(VueEvents);

describe.skip("Notifier component", () => {
	it("should activate when message received and set message text", async () => {
		let wrapper = mount(Notifier, {
			localVue,
			props: {
				event: "test",
			},
		});
		wrapper.vm.onMessage({ message: "test" });
		expect(wrapper.vm.active).toBe(true);
		expect(wrapper.vm.message).toEqual("test");
		await wrapper.destroy();
	});
});
