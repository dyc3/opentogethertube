import Vue from 'vue';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import Vuex from 'vuex';
import _ from "lodash";

const localVue = createLocalVue();
localVue.use(Vuex);

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

const testVideo = {
	service: "fakeservice",
	id: "asdf1234",
	title: "test",
	description: "desc",
	length: 10,
	thumbnail: "https://example.com/img.png",
};

describe.skip("VideoQueueItem", () => {
	it("should show add button when queueMode is manual and isPreview", () => {
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
			propsData: {
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

	it("should show check icon when queueMode is manual and isPreview and video is currently playing", () => {
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
			propsData: {
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

	it("should show check icon when queueMode is manual and isPreview and video is in queue", () => {
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
			propsData: {
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
			propsData: {
				item: testVideo,
				isPreview: false,
			},
		});
		let buttons = wrapper.findAll("button");
		expect(buttons.exists()).toBe(true);
		expect(buttons.length).toBe(1);
		let icon = buttons.at(0).find(".v-icon");
		expect(icon.exists()).toBe(true);
		expect(icon.classes()).toContain("fas", "fa-trash");
	});

	it("should show vote button and trash button when queueMode is vote and in queue", () => {
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
			propsData: {
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
				propsData: {
					item: testVideo,
					isPreview: true,
				},
			});
			expect(wrapper.vm.getPostData()).toEqual(_.pick(testVideo, "service", "id"));
		});
	});
});
