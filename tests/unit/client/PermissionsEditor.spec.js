import Vue from 'vue';
import { mount, shallowMount, createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import Vuetify from 'vuetify';
import PermissionsEditor from "@/components/PermissionsEditor.vue";

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
				currentSource: { length: 0 },
				queue: [],
				isPlaying: false,
				playbackPosition: 0,
				grants: 0b11111111111111111111111111111111,
				users: [],
				events: [],
			},
			quickAdd: [],
			permsMeta: {
				loaded: true,
				roles: {
					0: {
						id: 0,
						name: "unregistered",
						display: "Unregistered User",
					},
					1: {
						id: 1,
						name: "registered",
						display: "Registered User",
					},
					2: {
						id: 2,
						name: "trusted",
						display: "Trusted User",
					},
					3: {
						id: 3,
						name: "mod",
						display: "Moderator",
					},
					4: {
						id: 4,
						name: "admin",
						display: "Administrator",
					},
					"-1": {
						id: -1,
						name: "owner",
						display: "Owner",
					},
				},
				permissions: [
					{ name: "playback.play-pause", mask: 1<<0, minRole: 0 },
					{ name: "playback.skip", mask: 1<<1, minRole: 0 },
					{ name: "playback.seek", mask: 1<<2, minRole: 0 },
					{ name: "manage-queue.add", mask: 1<<3, minRole: 0 },
					{ name: "manage-queue.remove", mask: 1<<4, minRole: 0 },
					{ name: "manage-queue.order", mask: 1<<5, minRole: 0 },
				],
			},
		},
		actions: {
			updatePermissionsMetadata: jest.fn(),
		},
	});
}

describe("PermissionsEditor Component", () => {
	let store = createStore();

	it("should display grants accurately", async () => {
		let wrapper = mount(PermissionsEditor, {
			localVue,
			store,
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

		await wrapper.destroy();

		// inherited permissions
		wrapper = mount(PermissionsEditor, {
			localVue,
			store,
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

		await wrapper.destroy();
	});

	it("getLowestGranted should do what it says", async () => {
		let component = shallowMount(PermissionsEditor, {
			localVue,
			store,
			propsData: {
				value: { 0: 1<<0 },
			},
		}).vm;
		expect(component.getLowestGranted({
			4: true,
			3: true,
			2: false,
			1: false,
			0: false,
		})).toEqual(3);
		expect(component.getLowestGranted({
			4: true,
			3: true,
			2: false,
			1: false,
			0: true,
		})).toEqual(0);
		expect(component.getLowestGranted({
			4: false,
			3: false,
			2: false,
			1: false,
			0: false,
		})).toEqual(4);
	});

	it("getHighestDenied should do what it says", async () => {
		let component = shallowMount(PermissionsEditor, {
			localVue,
			store,
			propsData: {
				value: { 0: 1<<0 },
			},
		}).vm;
		expect(component.getHighestDenied({
			4: true,
			3: true,
			2: false,
			1: false,
			0: false,
		})).toEqual(2);
		expect(component.getHighestDenied({
			4: true,
			3: true,
			2: false,
			1: false,
			0: true,
		})).toEqual(2);
		expect(component.getHighestDenied({
			4: false,
			3: false,
			2: false,
			1: false,
			0: false,
		})).toEqual(3);
		expect(component.getHighestDenied({
			4: true,
			3: true,
			2: true,
			1: true,
			0: true,
		})).toEqual(null);
	});
});
