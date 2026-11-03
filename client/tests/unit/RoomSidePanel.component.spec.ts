import { beforeEach, describe, expect, it } from "vitest";
import { h } from "vue";
import { PlayerStatus, Role } from "ott-common/models/types";
import RoomSidePanel from "@/components/RoomSidePanel.vue";
import { chatMessagePast, chatMessageRecent } from "@/components/chat-state";
import { mountComponent } from "./component-test-utils";

function receiveChat() {
	chatMessageRecent.value.push({
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
}

function mountPanel(tab: "chat" | "users") {
	const { wrapper } = mountComponent(RoomSidePanel, {
		props: {
			tab,
			"onUpdate:tab": (value: string) => wrapper.setProps({ tab: value }),
		},
		slots: {
			chat: () => h("div", { "data-cy": "chat-slot" }),
			users: () => h("div", { "data-cy": "users-slot" }),
		},
	});
	return wrapper;
}

describe("RoomSidePanel component", () => {
	beforeEach(() => {
		chatMessagePast.value = [];
		chatMessageRecent.value = [];
	});

	it("keeps both tabs mounted so chat still receives messages on the Users tab", () => {
		const wrapper = mountPanel("users");

		expect(wrapper.find('[data-cy="chat-slot"]').exists()).toBe(true);
		expect(wrapper.find('[data-cy="users-slot"]').isVisible()).toBe(true);
		expect(wrapper.find('[data-cy="chat-slot"]').isVisible()).toBe(false);
	});

	it("counts unread messages while the Users tab is open", async () => {
		const wrapper = mountPanel("users");
		receiveChat();
		receiveChat();
		await wrapper.vm.$nextTick();

		expect(wrapper.get('[data-cy="room-panel-unread"]').text()).toBe("2");
	});

	it("clears the unread count when switching back to Chat", async () => {
		const wrapper = mountPanel("users");
		receiveChat();
		await wrapper.vm.$nextTick();
		await wrapper.setProps({ tab: "chat" });

		expect(wrapper.find('[data-cy="room-panel-unread"]').exists()).toBe(false);

		await wrapper.setProps({ tab: "users" });
		expect(wrapper.find('[data-cy="room-panel-unread"]').exists()).toBe(false);
	});

	it("doesn't count messages that arrive while Chat is open", async () => {
		const wrapper = mountPanel("chat");
		receiveChat();
		await wrapper.vm.$nextTick();
		await wrapper.setProps({ tab: "users" });

		expect(wrapper.find('[data-cy="room-panel-unread"]').exists()).toBe(false);
	});
});
