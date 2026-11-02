import { beforeEach, describe, expect, it, vi } from "vitest";
import RoomSidePanel from "@/components/RoomSidePanel.vue";
import { chatDraft } from "@/components/chat-state";
import Room from "@/views/Room.vue";
import { ChatPlacement } from "@/stores/settings";
import { mountComponent } from "./component-test-utils";

async function mountRoom() {
	const mounted = mountComponent(Room);
	// The settings module's state object is shared between test stores.
	mounted.store.commit("settings/UPDATE", { chatPlacement: ChatPlacement.panel });
	await mounted.router.push("/room/foo");
	await mounted.router.isReady();
	await mounted.wrapper.vm.$nextTick();
	return mounted;
}

function pressT() {
	window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyT", key: "t" }));
}

async function settle(wrapper: { vm: { $nextTick: () => Promise<void> } }) {
	await wrapper.vm.$nextTick();
	await wrapper.vm.$nextTick();
}

describe("Room chat", () => {
	beforeEach(() => {
		chatDraft.value = "";
		// Changing settings in the room adjusts the sound effect volume.
		vi.stubGlobal(
			"AudioContext",
			class {
				createGain() {
					return { connect: () => undefined, gain: { value: 1 } };
				}
			},
		);
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				matches: false,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
			})),
		);
	});

	it("keeps the T shortcut working after moving chat into the video", async () => {
		const { wrapper, store } = await mountRoom();
		expect(wrapper.find('[data-cy="room-side-panel"]').exists()).toBe(true);

		store.commit("settings/UPDATE", { chatPlacement: ChatPlacement.video });
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		expect(wrapper.find('[data-cy="room-side-panel"]').exists()).toBe(false);
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(false);

		pressT();
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(true);
	});

	it("switches to the Chat tab and focuses the input when T is pressed on Users", async () => {
		const { wrapper } = await mountRoom();
		wrapper.findComponent(RoomSidePanel).vm.$emit("update:tab", "users");
		await settle(wrapper);
		expect(wrapper.get('[data-cy="chat-input"]').isVisible()).toBe(false);

		pressT();
		await settle(wrapper);
		const input = wrapper.get('[data-cy="chat-input"]');
		expect(input.isVisible()).toBe(true);
		expect(document.activeElement).toBe(input.element);
	});

	it("keeps the T shortcut working in fullscreen", async () => {
		const { wrapper, store } = await mountRoom();
		store.state.fullscreen = true;
		await settle(wrapper);
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(false);

		pressT();
		await settle(wrapper);
		expect(wrapper.find('[data-cy="chat-input"]').exists()).toBe(true);
	});

	it("keeps an unsent draft when going fullscreen and back", async () => {
		const { wrapper, store } = await mountRoom();
		await wrapper.get('[data-cy="chat-input"]').setValue("half a thought");

		store.state.fullscreen = true;
		await settle(wrapper);
		store.state.fullscreen = false;
		await settle(wrapper);

		const input = wrapper.get('[data-cy="chat-input"]').element as HTMLInputElement;
		expect(input.value).toBe("half a thought");
	});

	it("keeps an unsent draft when moving chat into the video", async () => {
		const { wrapper, store } = await mountRoom();
		await wrapper.get('[data-cy="chat-input"]').setValue("half a thought");

		store.commit("settings/UPDATE", { chatPlacement: ChatPlacement.video });
		await settle(wrapper);
		pressT();
		await settle(wrapper);

		const input = wrapper.get('[data-cy="chat-input"]').element as HTMLInputElement;
		expect(input.value).toBe("half a thought");
	});
});
