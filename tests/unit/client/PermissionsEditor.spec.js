import Vue from 'vue';
import { mount } from '@vue/test-utils';
import Vuetify from 'vuetify';
import PermissionsEditor from "@/components/PermissionsEditor.vue";

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

describe("PermissionsEditor Component", () => {
	it("should display grants accurately", async () => {
		let wrapper = mount(PermissionsEditor, {
			propsData: {
				value: { 0: 1<<0 },
			},
		});

		// bare minimum
		await wrapper.vm.$nextTick();

		expect(wrapper.vm.permissions[0][0]).toBe(true);
		expect(wrapper.vm.permissions[0][1]).toBe(true);
		expect(wrapper.vm.permissions[0][2]).toBe(true);
		expect(wrapper.vm.permissions[0][3]).toBe(true);
		expect(wrapper.vm.permissions[0][4]).toBe(true);
		expect(wrapper.vm.permissions[1][0]).toBe(false);

		wrapper.destroy();

		// inherited permissions
		wrapper = mount(PermissionsEditor, {
			propsData: {
				value: { 0: 1<<0, 1: 1<<1 },
			},
		});
		await wrapper.vm.$nextTick();

		expect(wrapper.vm.permissions[0][0]).toBe(true);
		expect(wrapper.vm.permissions[0][1]).toBe(true);
		expect(wrapper.vm.permissions[0][2]).toBe(true);
		expect(wrapper.vm.permissions[1][0]).toBe(false);
		expect(wrapper.vm.permissions[1][1]).toBe(true);
		expect(wrapper.vm.permissions[1][2]).toBe(true);

		wrapper.destroy();
	});
});
