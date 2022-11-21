import { it, describe, expect } from "vitest";
import { createVuetify } from "vuetify";
import { mount } from "@vue/test-utils";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import Vuex from "vuex";
import _ from "lodash";
import { buildNewStore, key as storekey } from "@/store";
import { QueueMode } from "ott-common/models/types";
import { i18n } from "@/i18n";

function getMountOptions(store) {
	return {
		global: {
			plugins: [createVuetify(), [store, storekey], i18n],
		},
	};
}

const testVideo = {
	service: "fakeservice",
	id: "asdf1234",
	title: "test",
	description: "desc",
	length: 10,
	thumbnail: "https://example.com/img.png",
};

describe("VideoQueueItem", () => {
	it("should only include service and id props in getPostData", () => {
		let store = buildNewStore();

		// @ts-expect-error
		let wrapper = mount(VideoQueueItem, {
			...getMountOptions(store),
			props: {
				item: testVideo,
				isPreview: false,
			},
		});
		let comp = wrapper.getComponent(VideoQueueItem);
		// comp.vm.getPostData()
		expect(comp.vm.getPostData()).toEqual(_.pick(testVideo, "service", "id"));
	});
});
