import { describe, it, expect, vi } from "vitest";
// import { document } from "jsdom";
import { KeyboardShortcuts } from "../../src/util/keyboard-shortcuts";

describe("KeyboardShortcuts", () => {
	it("should bind and unbind", () => {
		const shortcuts = new KeyboardShortcuts();
		const binding = { code: "KeyA" };
		const action = vi.fn();

		shortcuts.bind(binding, action);
		shortcuts.handleKeyDown(new KeyboardEvent("keydown", binding));
		expect(action).toHaveBeenCalledTimes(1);

		shortcuts.unbind(binding);
		shortcuts.handleKeyDown(new KeyboardEvent("keydown", binding));
		expect(action).toHaveBeenCalledTimes(1);
	});

	it("should bind multiple bindings for the same action", () => {
		const shortcuts = new KeyboardShortcuts();
		const binding = [{ code: "KeyA" }, { code: "KeyB" }];
		const action = vi.fn();

		shortcuts.bind(binding, action);
		shortcuts.handleKeyDown(
			new KeyboardEvent("keydown", {
				code: "KeyA",
			})
		);
		shortcuts.handleKeyDown(
			new KeyboardEvent("keydown", {
				code: "KeyB",
			})
		);
		expect(action).toHaveBeenCalledTimes(2);
	});

	it("should not bind duplicate bindings", () => {
		const shortcuts = new KeyboardShortcuts();
		const binding = { code: "KeyA" };
		const action = vi.fn();

		shortcuts.bind(binding, action);
		shortcuts.bind(binding, action);
		expect(shortcuts.shortcuts.length).toBe(1);
	});

	it("should only match the key combo", () => {
		const shortcuts = new KeyboardShortcuts();
		const bindBad = { code: "KeyA" };
		const bindGood = { code: "KeyA", ctrlKey: true };
		const actionBad = vi.fn();
		const actionGood = vi.fn();

		shortcuts.bind(bindBad, actionBad);
		shortcuts.bind(bindGood, actionGood);
		shortcuts.handleKeyDown(
			new KeyboardEvent("keydown", {
				code: "KeyA",
				ctrlKey: true,
			})
		);
		expect(actionBad).toHaveBeenCalledTimes(0);
		expect(actionGood).toHaveBeenCalledTimes(1);
	});

	it.each(["input", "textarea"])(
		"should not match any bindings when an element of type %s is focused",
		(nodeName: string) => {
			const shortcuts = new KeyboardShortcuts();
			const binding = { code: "KeyA" };
			const action = vi.fn();
			const onkeydownInvoke = vi.fn();

			function doOnKeyDown() {
				onkeydownInvoke();
				shortcuts.handleKeyDown(event);
			}
			document.onkeydown = doOnKeyDown;
			let element = document.createElement(nodeName);
			element.onkeydown = doOnKeyDown;
			document.body.appendChild(element);
			shortcuts.bind(binding, action);
			let event = new KeyboardEvent("keydown", {
				code: "KeyA",
			});
			document.dispatchEvent(event);
			element.dispatchEvent(event);
			expect(action).toHaveBeenCalledTimes(1);
			expect(onkeydownInvoke).toHaveBeenCalledTimes(2);
		}
	);
});
