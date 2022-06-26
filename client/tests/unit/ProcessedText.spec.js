import Vue from "vue";
import { mount, createLocalVue } from "@vue/test-utils";
import Vuetify from "vuetify";
import ProcessedText from "@/components/ProcessedText.vue";
import { i18n } from "@/i18n";

const localVue = createLocalVue();

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

describe("ProcessedText component", () => {
	it("should render nothing", () => {
		let wrapper = mount(ProcessedText, {
			localVue,
			i18n,
			propsData: { text: "" },
			mounted: jest.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(0);
	});

	it("should just render text as is", () => {
		let wrapper = mount(ProcessedText, {
			localVue,
			i18n,
			propsData: { text: "test text" },
			mounted: jest.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(1);
		expect(wrapper.vm.content).toEqual([{ type: "text", text: "test text" }]);
	});

	it("should render just the link", () => {
		let wrapper = mount(ProcessedText, {
			localVue,
			i18n,
			propsData: { text: "https://example.com/" },
			mounted: jest.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(1);
		expect(wrapper.vm.content).toEqual([{ type: "link", text: "https://example.com/" }]);
	});

	it("should render text and link", () => {
		let wrapper = mount(ProcessedText, {
			localVue,
			i18n,
			propsData: { text: "peter https://example.com/ griffin" },
			mounted: jest.fn(),
		});
		wrapper.vm.processText();
		expect(wrapper.vm.content).toHaveLength(3);
		expect(wrapper.vm.content).toEqual([
			{ type: "text", text: "peter " },
			{ type: "link", text: "https://example.com/" },
			{ type: "text", text: " griffin" },
		]);
	});

	it("should fire event when link is clicked", async () => {
		let wrapper = mount(ProcessedText, {
			localVue,
			i18n,
			propsData: { text: "https://example.com/" },
			mounted: jest.fn(),
		});
		wrapper.vm.processText();
		await wrapper.vm.$nextTick();
		wrapper.find(".link").trigger("click");
		expect(wrapper.emitted("link-click")).toEqual([["https://example.com/"]]);
	});
});
