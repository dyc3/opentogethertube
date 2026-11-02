import { describe, expect, it } from "vitest";
import ChatPlacementToggle from "@/components/ChatPlacementToggle.vue";
import { ChatPlacement } from "@/stores/settings";
import { mountComponent } from "./component-test-utils";

describe("ChatPlacementToggle component", () => {
	it("saves the chosen placement", async () => {
		const { wrapper, store } = mountComponent(ChatPlacementToggle, {
			props: { inVideoAllowed: true },
		});
		await wrapper.get('[data-cy="chat-placement-video"]').trigger("click");
		expect(store.state.settings.chatPlacement).toBe(ChatPlacement.video);

		await wrapper.get('[data-cy="chat-placement-panel"]').trigger("click");
		expect(store.state.settings.chatPlacement).toBe(ChatPlacement.panel);
	});

	it("shows the panel and disables in-video when the video forbids overlays", async () => {
		const { wrapper, store } = mountComponent(ChatPlacementToggle, {
			props: { inVideoAllowed: false },
		});
		store.commit("settings/UPDATE", { chatPlacement: ChatPlacement.video });
		await wrapper.vm.$nextTick();

		const video = wrapper.get('[data-cy="chat-placement-video"]');
		expect(video.attributes("disabled")).toBeDefined();
		expect(wrapper.get('[data-cy="chat-placement-panel"]').attributes("data-state")).toBe("on");

		await video.trigger("click");
		// The preference is kept for videos that allow in-video chat.
		expect(store.state.settings.chatPlacement).toBe(ChatPlacement.video);
	});
});
