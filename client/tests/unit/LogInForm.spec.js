import { it, describe, expect, beforeEach } from "vitest";
import Vuex from "vuex";
import { shallowMount, mount } from "@vue/test-utils";
import Vuetify from "vuetify";
import LogInForm from "@/components/LogInForm.vue";
import { i18n } from "@/i18n";

describe.skip("Login form", () => {
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
			vuetify,
			i18n,
			stubs: ["router-link"],
		});
		expect(wrapper.exists()).toBe(true);
	});

	it("should have all password fields be type=password", () => {
		const wrapper = mount(LogInForm, {
			store,
			vuetify,
			i18n,
			stubs: ["router-link"],
		});

		let passwordFields = wrapper
			.findAll(".v-input")
			.filter(e => e.find("label").text.lower().includes("password"));
		for (let i = 0; i < passwordFields.length; i++) {
			expect(passwordFields.at(i).find("input").type).toEqual("password");
		}
	});

	it("should have all fields be required", () => {
		const wrapper = mount(LogInForm, {
			store,
			vuetify,
			i18n,
			stubs: ["router-link"],
		});

		let fields = wrapper.findAll(".v-input");
		for (let i = 0; i < fields.length; i++) {
			expect(fields.at(i).find("input").required).toEqual("required");
		}
	});
});
