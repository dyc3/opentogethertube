import { it, describe, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ProcessedText from "@/components/ProcessedText.vue";
import { i18n } from "@/i18n";
import { createVuetify } from "vuetify";

const mountOptions = {
	global: {
		plugins: [createVuetify(), i18n],
	},
};

describe("ProcessedText component", () => {
	it("should render nothing", () => {
		let wrapper = mount(ProcessedText, {
			...mountOptions,
			props: { text: "" },
			mounted: vi.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(0);
	});

	it("should just render text as is", () => {
		let wrapper = mount(ProcessedText, {
			...mountOptions,
			props: { text: "test text" },
			mounted: vi.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(1);
		expect(wrapper.vm.content).toEqual([{ type: "text", text: "test text" }]);
	});

	it("should render just the link", () => {
		let wrapper = mount(ProcessedText, {
			...mountOptions,
			props: { text: "https://example.com/" },
			mounted: vi.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(1);
		expect(wrapper.vm.content).toEqual([{ type: "link", text: "https://example.com/" }]);
	});

	it("should render text and link", () => {
		let wrapper = mount(ProcessedText, {
			...mountOptions,
			props: { text: "peter https://example.com/ griffin" },
			mounted: vi.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(3);
		expect(wrapper.vm.content).toEqual([
			{ type: "text", text: "peter " },
			{ type: "link", text: "https://example.com/" },
			{ type: "text", text: " griffin" },
		]);
	});

	it.skip("should fire event when link is clicked", async () => {
		let wrapper = mount(ProcessedText, {
			...mountOptions,
			props: { text: "https://example.com/" },
			mounted: vi.fn(),
		});
		wrapper.vm.processText();
		await wrapper.vm.$nextTick();
		wrapper.find(".link").trigger("click");
		expect(wrapper.emitted("link-click")).toEqual([["https://example.com/"]]);
	});
});
