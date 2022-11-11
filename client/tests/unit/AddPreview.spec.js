import { it, describe, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { createStore } from "vuex";
import AddPreview from "@/components/AddPreview.vue";
import VBtn from "vuetify/lib/components/VBtn";
import { i18n } from "@/i18n";
import { createVuetify } from "vuetify";

const vuetify = createVuetify();

function mountNewInstance(store) {
	return mount(AddPreview, {
		global: {
			plugins: [store, i18n, vuetify],
			stubs: ["router-link"],
		},
	});
}

describe("AddPreview", () => {
	let wrapper;
	let store;

	beforeEach(() => {
		store = createStore({
			state: {
				production: true,
			},
		});
		wrapper = mountNewInstance(store);
	});

	afterEach(async () => {
		await wrapper.unmount();
	});

	it("should render test buttons when in dev environment", async () => {
		store.state.production = false;
		await wrapper.vm.$nextTick();
		const testVideoButtons = wrapper.find(".video-add").findAllComponents(VBtn);
		expect(testVideoButtons.length).toBeGreaterThanOrEqual(1);
	});

	it("should NOT render test buttons when in production environment", () => {
		store.state.production = true;
		const testVideoButtons = wrapper.find(".video-add").findAllComponents(VBtn);
		expect(testVideoButtons.length).toEqual(0);
	});

	it("should determine if the add preview link is a URL", () => {
		vi.spyOn(wrapper.vm, "requestAddPreviewDebounced").mockImplementation();

		wrapper.setData({ inputAddPreview: "https://example.com" });
		expect(wrapper.vm.isAddPreviewInputUrl).toEqual(true);

		wrapper.setData({ inputAddPreview: "pokimane feet compilation" });
		expect(wrapper.vm.isAddPreviewInputUrl).toEqual(false);
	});

	it("should request add previews when input is URL", async () => {
		vi.spyOn(wrapper.vm, "requestAddPreviewDebounced").mockImplementation();

		wrapper.setData({ inputAddPreview: "https://example.com" });
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.requestAddPreviewDebounced).toBeCalled();
		wrapper.vm.requestAddPreviewDebounced.mockClear();

		wrapper.setData({ inputAddPreview: "       " });
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.requestAddPreviewDebounced).not.toBeCalled();
		wrapper.vm.requestAddPreviewDebounced.mockClear();

		wrapper.setData({ inputAddPreview: "how to get smaller toes" });
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.requestAddPreviewDebounced).not.toBeCalled();
		wrapper.vm.requestAddPreviewDebounced.mockClear();
	});
});
