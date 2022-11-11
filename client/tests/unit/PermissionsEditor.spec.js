import { it, describe, expect } from "vitest";
import Vue from "vue";
import { shallowMount, createLocalVue } from "@vue/test-utils";
import Vuex from "vuex";
import Vuetify from "vuetify";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { i18n } from "@/i18n";

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();
localVue.use(Vuex);

function createStore() {
	return new Vuex.Store({
		state: {
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

describe("PermissionsEditor Component", () => {
	let store = createStore();

	it("should display grants accurately", async () => {
		let wrapper = shallowMount(PermissionsEditor, {
			localVue,
			store,
			i18n,
			propsData: {
				value: { 0: 1 << 0 },
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

		await wrapper.unmount();

		// inherited permissions
		wrapper = shallowMount(PermissionsEditor, {
			localVue,
			store,
			i18n,
			propsData: {
				value: { 0: 1 << 0, 1: 1 << 1 },
			},
		});
		await wrapper.vm.$nextTick();

		expect(wrapper.vm.permissions[0][0]).toBe(true);
		expect(wrapper.vm.permissions[0][1]).toBe(true);
		expect(wrapper.vm.permissions[0][2]).toBe(true);
		expect(wrapper.vm.permissions[1][0]).toBe(false);
		expect(wrapper.vm.permissions[1][1]).toBe(true);
		expect(wrapper.vm.permissions[1][2]).toBe(true);

		await wrapper.unmount();
	});

	it("getLowestGranted should do what it says", async () => {
		let component = shallowMount(PermissionsEditor, {
			localVue,
			store,
			i18n,
			propsData: {
				value: { 0: 1 << 0 },
			},
		}).vm;
		expect(
			component.getLowestGranted({
				4: true,
				3: true,
				2: false,
				1: false,
				0: false,
			})
		).toEqual(3);
		expect(
			component.getLowestGranted({
				4: true,
				3: true,
				2: false,
				1: false,
				0: true,
			})
		).toEqual(0);
		expect(
			component.getLowestGranted({
				4: false,
				3: false,
				2: false,
				1: false,
				0: false,
			})
		).toEqual(4);
	});

	it("getHighestDenied should do what it says", async () => {
		let component = shallowMount(PermissionsEditor, {
			localVue,
			store,
			i18n,
			propsData: {
				value: { 0: 1 << 0 },
			},
		}).vm;
		expect(
			component.getHighestDenied({
				4: true,
				3: true,
				2: false,
				1: false,
				0: false,
			})
		).toEqual(2);
		expect(
			component.getHighestDenied({
				4: true,
				3: true,
				2: false,
				1: false,
				0: true,
			})
		).toEqual(2);
		expect(
			component.getHighestDenied({
				4: false,
				3: false,
				2: false,
				1: false,
				0: false,
			})
		).toEqual(3);
		expect(
			component.getHighestDenied({
				4: true,
				3: true,
				2: true,
				1: true,
				0: true,
			})
		).toEqual(null);
	});
});
