import { describe, expect, it, vi } from "vitest";
import ClickToEdit from "@/components/ClickToEdit.vue";
import { mountComponent } from "./component-test-utils";

describe("ClickToEdit component", () => {
	it("renders .editable", () => {
		const { wrapper } = mountComponent(ClickToEdit);

		expect(wrapper.find(".editable").exists()).toBe(true);
		expect(wrapper.get(".editable").classes()).toContain("editable");
	});

	it("renders a string", () => {
		const { wrapper } = mountComponent(ClickToEdit, { props: { modelValue: "Hello World" } });

		expect(wrapper.get(".editable").text()).toContain("Hello World");
	});

	it("can edit a string", async () => {
		const changeSpy = vi.fn();
		const updateModelValueSpy = vi.fn();
		const { wrapper } = mountComponent(ClickToEdit, {
			props: {
				modelValue: "Hello World",
				onChange: changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			},
		});

		await wrapper.get(".editable").trigger("click");
		await wrapper.get("input").setValue("foo");
		await wrapper.get("input").trigger("keyup.enter");

		expect(changeSpy).toHaveBeenCalledWith("foo");
		expect(updateModelValueSpy).toHaveBeenCalledWith("foo");
	});

	it("does not edit when escape is pressed or focus is lost", async () => {
		const changeSpy = vi.fn();
		const updateModelValueSpy = vi.fn();
		const { wrapper } = mountComponent(ClickToEdit, {
			props: {
				modelValue: "Hello World",
				onChange: changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			},
		});

		await wrapper.get(".editable").trigger("click");
		await wrapper.get("input").setValue("foo");
		await wrapper.get("input").trigger("keyup.esc");
		await wrapper.vm.$nextTick();
		await wrapper.get(".editable").trigger("click");
		await wrapper.get("input").setValue("foo");
		await wrapper.get("input").trigger("blur");

		expect(changeSpy).not.toHaveBeenCalled();
		expect(updateModelValueSpy).not.toHaveBeenCalled();
	});

	it("renders and edits a number", async () => {
		const changeSpy = vi.fn();
		const updateModelValueSpy = vi.fn();
		const { wrapper } = mountComponent(ClickToEdit, {
			props: {
				modelValue: 420,
				onChange: changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			},
		});

		expect(wrapper.get(".editable").text()).toContain("420");
		await wrapper.get(".editable").trigger("click");
		await wrapper.get("input").setValue("123");
		await wrapper.get("input").trigger("keyup.enter");

		expect(changeSpy).toHaveBeenCalledWith(123);
		expect(updateModelValueSpy).toHaveBeenCalledWith(123);
	});
});
