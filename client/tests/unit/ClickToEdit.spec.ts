import { it, describe, expect } from "vitest";
import { createVuetify } from "vuetify";
import { mount } from "@vue/test-utils";
// @ts-ignore for some reason, this is not a valid import to typescript, but it works. Unfortunately, this completely destroys type checking. This also only occurs in the test environment, which is the only place that it matters. For some reason, when running `yarn build` it works fine. I also don't know why `yarn build` even touches this file.
import ClickToEdit from "@/components/ClickToEdit.vue";

const mountOptions = {
	global: {
		plugins: [createVuetify()],
	},
};

describe("ClickToEdit", () => {
	it.concurrent.each([5, "five"])("renders value by default, with no text box", testVal => {
		const wrapper = mount(ClickToEdit, {
			props: {
				modelValue: testVal,
			},
			...mountOptions,
		});
		expect(wrapper.find("input").exists()).toEqual(false);
		expect(wrapper.text()).toEqual(testVal.toString());
	});

	it.concurrent.each([
		[5, "101"],
		["five", "five"],
	])("renders only number values with formatter", (testVal, expected) => {
		const wrapper = mount(ClickToEdit, {
			props: {
				modelValue: testVal,
				valueFormatter: (val: number) => val.toString(2),
			},
			...mountOptions,
		});
		expect(wrapper.find("input").exists()).toEqual(false);
		expect(wrapper.text()).toEqual(expected);
	});

	it("should activate text box when clicked", async () => {
		const wrapper = mount(ClickToEdit, {
			props: {
				modelValue: 5,
			},
			...mountOptions,
		});
		expect(wrapper.find("input").exists()).toEqual(false);
		wrapper.get(".editable").trigger("click");
		await wrapper.vm.$nextTick();
		expect(wrapper.find("input").exists()).toEqual(true);
	});
});
