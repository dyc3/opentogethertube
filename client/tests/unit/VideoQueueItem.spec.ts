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
	it.skip("should show add button when queueMode is manual and isPreview", () => {
		let store = new Vuex.Store({
			state: {
				room: {
					currentSource: {},
					queue: [],
					queueMode: "manual",
					voteCounts: new Map(),
				},
			},
		});
		let wrapper = mount(VideoQueueItem, {
			store,
			localVue,
			props: {
				item: testVideo,
				isPreview: true,
			},
		});
		let button = wrapper.find("button");
		expect(button.exists()).toBe(true);
		let icon = button.find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fas", "fa-plus");
	});

	it.skip("should show check icon when queueMode is manual and isPreview and video is currently playing", () => {
		let store = new Vuex.Store({
			state: {
				room: {
					currentSource: {},
					queue: [testVideo],
					queueMode: "manual",
					voteCounts: new Map(),
				},
			},
		});
		let wrapper = mount(VideoQueueItem, {
			store,
			localVue,
			props: {
				item: testVideo,
				isPreview: true,
			},
		});
		let button = wrapper.find("button");
		expect(button.exists()).toBe(true);
		let icon = button.find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fas", "fa-check");
	});

	it.skip("should show check icon when queueMode is manual and isPreview and video is in queue", () => {
		let store = new Vuex.Store({
			state: {
				room: {
					currentSource: testVideo,
					queue: [],
					queueMode: "manual",
					voteCounts: new Map(),
				},
			},
		});
		let wrapper = mount(VideoQueueItem, {
			store,
			localVue,
			props: {
				item: testVideo,
				isPreview: true,
			},
		});
		let button = wrapper.find("button");
		expect(button.exists()).toBe(true);
		let icon = button.find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fas", "fa-check");
	});

	it("should show trash button when queueMode is manual and in queue", () => {
		let store = buildNewStore();
		store.state.room.queueMode = QueueMode.Manual;

		let wrapper = mount(VideoQueueItem, {
			...getMountOptions(store),
			props: {
				item: testVideo,
				isPreview: false,
			},
		});
		let buttons = wrapper.findAll("button");
		expect(buttons.length).toBe(3);
		let icon = buttons[1].find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fa-trash");
	});

	it.skip("should show vote button and trash button when queueMode is vote and in queue", () => {
		let store = new Vuex.Store({
			state: {
				room: {
					currentSource: {},
					queue: [],
					queueMode: "vote",
					voteCounts: new Map(),
				},
			},
		});
		let wrapper = mount(VideoQueueItem, {
			store,
			localVue,
			props: {
				item: testVideo,
				isPreview: false,
			},
		});
		let buttons = wrapper.findAll("button");
		expect(buttons.exists()).toBe(true);
		expect(buttons.length).toBe(2);
		let icon = buttons.at(0).find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fas", "fa-thumbs-up");
		icon = buttons.at(1).find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fas", "fa-trash");
	});

	describe("getPostData", () => {
		it("should only include service and id props", () => {
			let store = buildNewStore();

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
});
