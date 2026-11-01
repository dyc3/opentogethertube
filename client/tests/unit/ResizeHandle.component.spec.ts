import { describe, expect, it } from "vitest";
import ResizeHandle from "@/components/ResizeHandle.vue";
import { mountComponent } from "./component-test-utils";

function mountHandle(modelValue = 400) {
	const state = { size: modelValue };
	// The handle may emit while mounting (to clamp), before mountComponent returns.
	const holder: { mounted?: ReturnType<typeof mountComponent> } = {};
	holder.mounted = mountComponent(ResizeHandle, {
		props: {
			modelValue,
			"onUpdate:modelValue": (value: number) => {
				state.size = value;
				return holder.mounted?.wrapper.setProps({ modelValue: value });
			},
			label: "Resize",
			direction: -1,
			min: 280,
			defaultSize: 400,
		},
	});
	return { wrapper: holder.mounted.wrapper, state };
}

function pointer(type: string, clientX: number) {
	window.dispatchEvent(new MouseEvent(type, { clientX }));
}

// jsdom's default viewport is 1024px wide, so the default max (60%) is 614px.
describe("ResizeHandle component", () => {
	it("grows a right-hand panel when dragged left", async () => {
		const { wrapper, state } = mountHandle();
		await wrapper.trigger("pointerdown", { button: 0, clientX: 600 });
		pointer("pointermove", 500);
		pointer("pointerup", 500);

		expect(state.size).toBe(500);
	});

	it("clamps to the min and max width", async () => {
		const { wrapper, state } = mountHandle();
		await wrapper.trigger("pointerdown", { button: 0, clientX: 600 });
		pointer("pointermove", 0);
		expect(state.size).toBe(614);
		pointer("pointermove", 1000);
		expect(state.size).toBe(280);
		pointer("pointerup", 1000);
	});

	it("shields the page while dragging so iframes can't swallow the pointer", async () => {
		const { wrapper } = mountHandle();
		expect(document.querySelector('[data-cy="resize-shield"]')).toBeNull();

		await wrapper.trigger("pointerdown", { button: 0, clientX: 600 });
		expect(document.querySelector('[data-cy="resize-shield"]')).not.toBeNull();

		pointer("pointerup", 600);
		await wrapper.vm.$nextTick();
		expect(document.querySelector('[data-cy="resize-shield"]')).toBeNull();
	});

	it("stops following the pointer after release", async () => {
		const { wrapper, state } = mountHandle();
		await wrapper.trigger("pointerdown", { button: 0, clientX: 600 });
		pointer("pointerup", 600);
		pointer("pointermove", 400);

		expect(state.size).toBe(400);
	});

	it("resizes with the arrow keys without letting them reach the room shortcuts", async () => {
		const { wrapper, state } = mountHandle();
		let reachedWindow = false;
		const onKeyDown = () => {
			reachedWindow = true;
		};
		window.addEventListener("keydown", onKeyDown);
		try {
			await wrapper.trigger("keydown", { key: "ArrowLeft" });
			expect(state.size).toBe(424);
			await wrapper.trigger("keydown", { key: "ArrowRight" });
			expect(state.size).toBe(400);
			expect(reachedWindow).toBe(false);
		} finally {
			window.removeEventListener("keydown", onKeyDown);
		}
	});

	it("resets to the default size on double-click", async () => {
		const { wrapper, state } = mountHandle(550);
		await wrapper.trigger("dblclick");

		expect(state.size).toBe(400);
	});

	it("clamps a stored size that no longer fits the viewport", () => {
		const { state } = mountHandle(5000);

		expect(state.size).toBe(614);
	});
});
