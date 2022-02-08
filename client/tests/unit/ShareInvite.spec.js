import Vue from 'vue';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import ShareInvite from "@/components/ShareInvite.vue";
import { i18n } from "@/i18n";

const localVue = createLocalVue();

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const $route = {
	path: 'http://localhost:8080/room/ligma',
	params: {
		roomId: 'ligma',
	},
  };

describe("ShareInvite component", () => {
	beforeEach(() => {
		delete process.env.SHORT_URL;
	});

	it("should use SHORT_URL if available", () => {
		process.env.SHORT_URL = "example.com";
		let wrapper = mount(ShareInvite, {
			localVue,
			i18n,
			mocks: {
				$route,
			},
			stubs: ["v-icon", "v-text-field"],
		});
		expect(wrapper.vm.inviteLink).toContain("example.com");
	});

	it("should use window.location if SHORT_URL not provided", () => {
		let wrapper = mount(ShareInvite, {
			localVue,
			mocks: {
				$route,
			},
			stubs: ["v-icon", "v-text-field"],
		});
		expect(wrapper.vm.inviteLink).toContain(window.location.href);
	});

	it("should contain the room name in the invite link", () => {
		process.env.SHORT_URL = "example.com";
		let wrapper = mount(ShareInvite, {
			localVue,
			mocks: {
				$route,
			},
			stubs: ["v-icon", "v-text-field"],
		});
		expect(wrapper.vm.inviteLink).toContain("ligma");
	});
});
