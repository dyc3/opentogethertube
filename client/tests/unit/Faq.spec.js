import { it, describe } from "vitest";
import Vue from "vue";
import { shallowMount } from "@vue/test-utils";
import Vuetify from "vuetify";
import Faq from "@/views/Faq.vue";
import { i18n } from "@/i18n";

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

describe("FAQ view", () => {
	// eslint-disable-next-line jest/expect-expect
	it("should render without failing", () => {
		shallowMount(Faq, {
			i18n,
		});
	});
});
