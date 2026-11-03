import { beforeEach, describe, expect, it } from "vitest";
import {
	RoomRequestType,
	type ClientMessageRoomRequest,
	type ServerMessage,
} from "ott-common/models/messages";
import { PlayerStatus, Role } from "ott-common/models/types";
import Chat from "@/components/Chat.vue";
import { chatDraft } from "@/components/chat-state";
import { mountComponent } from "./component-test-utils";

describe("Chat component", () => {
	beforeEach(() => {
		chatDraft.value = "";
	});

	it("opens and closes from the buttons", async () => {
		const { wrapper } = mountComponent(Chat);

		await wrapper.get('[data-cy="chat-activate"]').trigger("click");
		expect(wrapper.find('[data-cy="chat-activate"]').exists()).toBe(false);
		expect(wrapper.find('[data-cy="chat-deactivate"]').exists()).toBe(true);
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(true);

		await wrapper.get('[data-cy="chat-deactivate"]').trigger("click");
		expect(wrapper.find('[data-cy="chat-activate"]').exists()).toBe(true);
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(false);
	});

	it("can hide its title row when always visible", () => {
		const { wrapper } = mountComponent(Chat, {
			props: { alwaysVisible: true, hideHeader: true },
		});

		expect(wrapper.find(".chat-header").exists()).toBe(false);
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(true);
	});

	it("sends the message when enter is pressed", async () => {
		const { wrapper, connection } = mountComponent(Chat);
		await wrapper.get('[data-cy="chat-activate"]').trigger("click");
		await wrapper.get('[data-cy="chat-input"]').setValue("foo");
		await wrapper.get('[data-cy="chat-input"]').trigger("keydown", { key: "Enter" });

		const expected: ClientMessageRoomRequest = {
			action: "req",
			request: { type: RoomRequestType.ChatRequest, text: "foo" },
		};
		expect(connection.sent).toEqual([expected]);
	});

	it("does not send empty or escaped messages", async () => {
		const { wrapper, connection } = mountComponent(Chat);
		await wrapper.get('[data-cy="chat-activate"]').trigger("click");
		await wrapper.get('[data-cy="chat-input"]').trigger("keydown", { key: "Enter" });
		await wrapper.get('[data-cy="chat-activate"]').trigger("click");
		await wrapper.get('[data-cy="chat-input"]').setValue("foo");
		await wrapper.get('[data-cy="chat-input"]').trigger("keydown", { key: "Escape" });

		expect(connection.sent).toEqual([]);
	});

	it("displays received messages", async () => {
		const { wrapper, connection } = mountComponent(Chat);
		await wrapper.get('[data-cy="chat-activate"]').trigger("click");
		const sentAt = Date.UTC(2026, 10, 1, 22, 41);
		const message: ServerMessage = {
			action: "chat",
			from: {
				id: "1",
				name: "goober",
				isLoggedIn: false,
				status: PlayerStatus.ready,
				role: Role.UnregisteredUser,
			},
			text: "foo",
			sentAt,
		};

		connection.mockReceive(message);
		await wrapper.vm.$nextTick();

		expect(wrapper.findAll(".message")).toHaveLength(1);
		expect(wrapper.get(".from").text()).toContain("goober");
		expect(wrapper.get(".text").text()).toContain("foo");
		expect(wrapper.get(".time").attributes("datetime")).toEqual("2026-11-01T22:41:00.000Z");
		// The time is shown in the local timezone, which can shift the minute (e.g. UTC+5:30).
		const localMinute = String(new Date(sentAt).getMinutes()).padStart(2, "0");
		expect(wrapper.get(".time").text()).toContain(`:${localMinute}`);
	});

	it("keeps the message list scrolled to the bottom when receiving messages", async () => {
		const { wrapper, connection } = mountComponent(Chat);
		await wrapper.get('[data-cy="chat-activate"]').trigger("click");
		const messages = wrapper.get(".messages").element as HTMLDivElement;
		Object.defineProperty(messages, "clientHeight", { configurable: true, value: 100 });
		Object.defineProperty(messages, "scrollHeight", { configurable: true, value: 300 });

		connection.mockReceive({
			action: "chat",
			from: {
				id: "1",
				name: "goober",
				isLoggedIn: false,
				status: PlayerStatus.ready,
				role: Role.UnregisteredUser,
			},
			text: "foo",
			sentAt: Date.now(),
		});
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();

		expect(messages.scrollTop).toBe(300);
	});
});
