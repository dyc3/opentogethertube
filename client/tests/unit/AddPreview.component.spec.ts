import { beforeEach, describe, expect, it, vi } from "vitest";
import AddPreview from "@/components/AddPreview.vue";
import { flush, mountComponent } from "./component-test-utils";

const { API } = vi.hoisted(() => ({
	API: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/common-http", () => ({ API }));

describe("AddPreview component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("immediately makes a single query if given a URL", async () => {
		API.get.mockResolvedValueOnce({
			data: {
				success: true,
				result: [
					{ service: "youtube", id: "1", title: "Foo", description: "Bar", length: 100 },
				],
			},
		});
		const { wrapper, store } = mountComponent(AddPreview);
		store.state.production = true;

		store.state.production = true;
		await wrapper.vm.$nextTick();
		await wrapper
			.get('[data-cy="add-preview-input"]')
			.setValue("https://youtube.com/watch?v=LP8GRjv6AIo");
		await new Promise(resolve => setTimeout(resolve, 1100));
		await flush();

		expect(API.get).toHaveBeenCalledWith(
			"/data/previewAdd?input=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3DLP8GRjv6AIo",
		);
		expect(wrapper.findAll(".video")).toHaveLength(1);
	});

	it("does not query non-URLs until manual search", async () => {
		API.get.mockResolvedValueOnce({
			data: {
				success: true,
				result: [
					{ service: "youtube", id: "1", title: "Foo", description: "Bar", length: 100 },
				],
			},
		});
		const { wrapper, store } = mountComponent(AddPreview);
		store.state.production = true;

		store.state.production = true;
		await wrapper.vm.$nextTick();
		await wrapper.get('[data-cy="add-preview-input"]').setValue("foo");
		await flush();
		expect(API.get).not.toHaveBeenCalled();

		await wrapper.get('[data-cy="add-preview-manual-search"]').trigger("click");
		await flush();

		expect(API.get).toHaveBeenCalledWith("/data/previewAdd?input=foo");
		expect(wrapper.findAll(".video")).toHaveLength(1);
	});

	it("does not show test videos in prod environment", async () => {
		const { wrapper, store } = mountComponent(AddPreview);
		store.state.production = true;
		await wrapper.vm.$nextTick();

		expect(wrapper.find('[data-cy="test-video"]').exists()).toBe(false);
	});
});
