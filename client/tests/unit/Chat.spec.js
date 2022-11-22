import { it, describe, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import Chat from "@/components/Chat.vue";
import Vuex from "vuex";
import { i18n } from "@/i18n";

function createStore() {
	return new Vuex.Store({
		state: {
			room: {
				chatMessages: [],
			},
		},
	});
}

function mountNewInstance(store) {
	return mount(Chat, {
		global: {
			plugins: [store, i18n, createVuetify()],
			stubs: ["ProcessedText", "v-icon"],
		},
	});
}

describe.skip("Chat component", () => {
	let wrapper;
	let store;

	beforeEach(() => {
		store = createStore();
		wrapper = mountNewInstance(store);
	});

	it("should stick to the bottom when scrolled to the bottom", async () => {
		wrapper.vm.setActivated(true);
		await wrapper.vm.$nextTick();
		wrapper.vm.onChatReceived({ from: "user", text: "test" });
		wrapper.vm.onChatReceived({ from: "user", text: "test" });
		wrapper.vm.onChatReceived({ from: "user", text: "test" });
		Object.defineProperty(wrapper.vm.messages, "scrollHeight", {
			configurable: true,
			writable: true,
			value: 100,
		});
		Object.defineProperty(wrapper.vm.messages, "clientHeight", {
			configurable: true,
			writable: true,
			value: 30,
		});
		Object.defineProperty(wrapper.vm.messages, "scrollTop", {
			configurable: true,
			writable: true,
			value: 50,
		});
		await wrapper.find(".messages").trigger("scroll");
		expect(wrapper.vm.stickToBottom).toEqual(false);

		wrapper.vm.messages.scrollHeight = 100;
		wrapper.vm.messages.clientHeight = 30;
		wrapper.vm.messages.scrollTop = 70;
		await wrapper.find(".messages").trigger("scroll");
		expect(wrapper.vm.stickToBottom).toEqual(true);
	});
});
