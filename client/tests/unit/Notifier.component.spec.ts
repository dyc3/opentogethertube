import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Notifier from "@/components/Notifier.vue";
import { ToastStyle } from "@/models/toast";
import { mountComponent } from "./component-test-utils";

describe("Notifier component", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders a toast notification", async () => {
		const { wrapper, store } = mountComponent(Notifier);
		store.commit("toast/CLEAR_ALL_TOASTS");
		store.commit("toast/ADD_TOAST", { content: "test" });
		await wrapper.vm.$nextTick();

		expect(store.state.toast.notifications).toHaveLength(1);
	});

	it("renders a toast notification with a custom duration", async () => {
		const { wrapper, store } = mountComponent(Notifier);
		store.commit("toast/CLEAR_ALL_TOASTS");
		store.commit("toast/ADD_TOAST", { content: "test", duration: 1000 });
		await wrapper.vm.$nextTick();
		expect(store.state.toast.notifications).toHaveLength(1);

		vi.advanceTimersByTime(1000);
		await wrapper.vm.$nextTick();

		expect(store.state.toast.notifications).toHaveLength(0);
	});

	for (const [toastStyle, className] of [
		[ToastStyle.Success, "bg-success"],
		[ToastStyle.Error, "bg-error"],
	] as const) {
		it(`renders a toast notification with ${className} style`, async () => {
			const { wrapper, store } = mountComponent(Notifier);
			store.commit("toast/CLEAR_ALL_TOASTS");
			store.commit("toast/ADD_TOAST", { content: "test", style: toastStyle });
			await wrapper.vm.$nextTick();

			expect(wrapper.get(".toast").classes()).toContain(className);
		});
	}

	it("renders toast structure used for dynamic sizing", async () => {
		const { wrapper, store } = mountComponent(Notifier);
		store.commit("toast/CLEAR_ALL_TOASTS");
		store.commit("toast/ADD_TOAST", { content: "test", duration: 1000 });
		await wrapper.vm.$nextTick();

		expect(wrapper.get(".toast-content").text()).toContain("test");
		expect((wrapper.get(".bar").element as HTMLElement).style.animationDuration).toBe("1000ms");
	});

	it("shows a close all button if there is more than 1 toast", async () => {
		const { wrapper, store } = mountComponent(Notifier);
		store.commit("toast/CLEAR_ALL_TOASTS");
		store.commit("toast/ADD_TOAST", { content: "test" });
		store.commit("toast/ADD_TOAST", { content: "test" });
		await wrapper.vm.$nextTick();

		expect(store.state.toast.notifications).toHaveLength(2);
		await wrapper.get('[data-cy="toast-close-all"]').trigger("click");

		expect(store.state.toast.notifications).toHaveLength(0);
	});
});
