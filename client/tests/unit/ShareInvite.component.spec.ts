import { describe, expect, it, vi } from "vitest";
import ShareInvite from "@/components/ShareInvite.vue";
import { mountComponent } from "./component-test-utils";

describe("ShareInvite component", () => {
	it("renders full url without query params if there is no short url present", () => {
		const { wrapper, store } = mountComponent(ShareInvite);
		store.state.room.name = "foobar";

		expect(
			(wrapper.get('[data-cy="share-invite-link"] input').element as HTMLInputElement).value,
		).not.toContain("foobar");
	});

	it("renders with short url if present", async () => {
		const { wrapper, store } = mountComponent(ShareInvite);
		store.state.room.name = "foobar";
		store.state.shortUrl = "ottr.cc";
		await wrapper.vm.$nextTick();

		expect(
			(wrapper.get('[data-cy="share-invite-link"] input').element as HTMLInputElement).value,
		).toBe("https://ottr.cc/foobar");
	});

	it("copies the link to the clipboard when the copy button is clicked", async () => {
		const writeText = vi.fn();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const { wrapper, store } = mountComponent(ShareInvite);
		store.state.room.name = "foobar";
		store.state.shortUrl = "ottr.cc";
		await wrapper.vm.$nextTick();

		await wrapper.get('[data-cy="share-invite-link"] [role="button"]').trigger("click");

		expect(writeText).toHaveBeenCalledWith("https://ottr.cc/foobar");
	});

	it("becomes success color when you click copy", async () => {
		vi.useFakeTimers();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn() },
		});
		const { wrapper, store } = mountComponent(ShareInvite);
		store.state.room.name = "foobar";
		store.state.shortUrl = "ottr.cc";
		await wrapper.vm.$nextTick();

		await wrapper.get('[data-cy="share-invite-link"] [role="button"]').trigger("click");
		expect(wrapper.get('[data-cy="share-invite-link"]').classes()).toContain("text-success");

		vi.advanceTimersByTime(3000);
		await wrapper.vm.$nextTick();
		expect(wrapper.get('[data-cy="share-invite-link"]').classes()).not.toContain(
			"text-success",
		);
		vi.useRealTimers();
	});
});
