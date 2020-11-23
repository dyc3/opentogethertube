import Vue from 'vue';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import Chat from "@/components/Chat.vue";
import Vuex from 'vuex';

const localVue = createLocalVue();
localVue.use(Vuex);

// HACK: import globally to prevent it from yelling at us
// https://github.com/vuetifyjs/vuetify/issues/4964
Vue.use(Vuetify);

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
		store,
		localVue,
		mocks: {
			$socket: {
				sendObj: jest.fn(),
			},
		},
		stubs: ["ProcessedText"],
	});
}

describe("Chat component", () => {
	let wrapper;
	let store;

	beforeEach(() => {
		store = createStore();
		wrapper = mountNewInstance(store);
	});

	it("should render required elements", () => {
		expect(wrapper.find(".chat-header").text()).toEqual("Chat");
		expect(wrapper.find(".messages").exists()).toBe(true);
		expect(wrapper.find("input").exists()).toBe(true);
	});

	it("should render chat messages", () => {
		wrapper.vm.$store.state.room.chatMessages = [{ from: "user", text: "test" }];
		expect(wrapper.findAll(".message")).toHaveLength(1);

		wrapper.setData({ stickToBottom: false });
		wrapper.vm.$store.state.room.chatMessages = [{ from: "user", text: "test" }, { from: "user", text: "test" }];
		expect(wrapper.findAll(".message")).toHaveLength(2);
	});

	it("should send chat message when enter is pressed", async () => {
		wrapper.setData({ inputValue: "test" });
		await wrapper.find("input").trigger("keydown.enter");
		expect(wrapper.vm.$socket.sendObj).toHaveBeenCalledWith({ action: "chat", text: "test" });
		expect(wrapper.vm.inputValue).toEqual("");
		expect(wrapper.vm.stickToBottom).toEqual(true);
	});

	it("should not send chat message when other keys are pressed", async () => {
		wrapper.setData({ inputValue: "test" });
		await wrapper.find("input").trigger("keydown", {
			key: 'a',
		});
		expect(wrapper.vm.$socket.sendObj).not.toHaveBeenCalled();
		expect(wrapper.vm.inputValue).toEqual("test");
	});

	it("should not send chat message when message length is 0", async () => {
		wrapper.setData({ inputValue: "" });
		await wrapper.find("input").trigger("keydown.enter");
		expect(wrapper.vm.$socket.sendObj).not.toHaveBeenCalled();
		expect(wrapper.vm.inputValue).toEqual("");

		wrapper.setData({ inputValue: "      " });
		await wrapper.find("input").trigger("keydown.enter");
		expect(wrapper.vm.$socket.sendObj).not.toHaveBeenCalled();
		expect(wrapper.vm.inputValue).toEqual("      ");
	});

	it("should stick to the bottom when scrolled to the bottom", async () => {
		wrapper.vm.$store.state.room.chatMessages = [
			{ from: "user", text: "test" },
			{ from: "user", text: "test" },
			{ from: "user", text: "test" },
		];
		Object.defineProperty(wrapper.vm.$refs.messages, 'scrollHeight', { configurable: true, writable: true, value: 100 });
		Object.defineProperty(wrapper.vm.$refs.messages, 'clientHeight', { configurable: true, writable: true, value: 30 });
		Object.defineProperty(wrapper.vm.$refs.messages, 'scrollTop', { configurable: true, writable: true, value: 50 });
		await wrapper.find(".messages").trigger("scroll");
		expect(wrapper.vm.stickToBottom).toEqual(false);

		wrapper.vm.$refs.messages.scrollHeight = 100;
		wrapper.vm.$refs.messages.clientHeight = 30;
		wrapper.vm.$refs.messages.scrollTop = 70;
		await wrapper.find(".messages").trigger("scroll");
		expect(wrapper.vm.stickToBottom).toEqual(true);
	});
});
