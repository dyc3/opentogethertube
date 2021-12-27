import Vue from 'vue';
import Vuex from 'vuex';
import { shallowMount, mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import LogInForm from '@/components/LogInForm.vue';

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const localVue = createLocalVue();
localVue.use(Vuex);

describe("Login form", () => {
	let vuetify;
	let store;

	beforeEach(() => {
		vuetify = new Vuetify();
		store = new Vuex.Store({
			state: {
				username: "stored username",
			},
		});
	});

	it("should render without failing", () => {
		let wrapper = shallowMount(LogInForm, {
			store,
			localVue,
			vuetify,
			stubs: ['router-link'],
		});
		expect(wrapper.exists()).toBe(true);
	});

	it("should have all password fields be type=password", () => {
		const wrapper = mount(LogInForm, {
			store,
			localVue,
			vuetify,
			stubs: ['router-link'],
		});

		let passwordFields = wrapper.findAll(".v-input").filter(e => e.find("label").text.lower().includes("password"));
		for (let i = 0; i < passwordFields.length; i++) {
			expect(passwordFields.at(i).find("input").type).toEqual("password");
		}
	});

	it("should have all fields be required", () => {
		const wrapper = mount(LogInForm, {
			store,
			localVue,
			vuetify,
			stubs: ['router-link'],
		});

		let fields = wrapper.findAll(".v-input");
		for (let i = 0; i < fields.length; i++) {
			expect(fields.at(i).find("input").required).toEqual("required");
		}
	});
});
