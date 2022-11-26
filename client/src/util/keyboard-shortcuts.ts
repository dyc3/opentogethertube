import { inject, InjectionKey } from "vue";
import _ from "lodash";

export class KeyboardShortcuts {
	shortcuts: [KeyBinding, (event: KeyboardEvent) => void][] = [];

	bind(binding: KeyBinding | KeyBinding[], action: (event: KeyboardEvent) => void) {
		if (Array.isArray(binding)) {
			for (let b of binding) {
				this.bind(b, action);
			}
		} else {
			// don't allow duplicate bindings
			for (let [b] of this.shortcuts) {
				if (_.isEqual(b, binding)) {
					console.warn("duplicate keyboard shortcut binding", binding);
					return;
				}
			}

			this.shortcuts.push([binding, action]);
		}
	}

	unbind(binding: KeyBinding) {
		this.shortcuts = this.shortcuts.filter(s => {
			return !_.isEqual(s[0], binding);
		});
	}

	handleKeyDown(event: KeyboardEvent) {
		if (event.target instanceof Element) {
			if (event.target.nodeName === "INPUT" || event.target.nodeName === "TEXTAREA") {
				return;
			}
		}

		for (let [binding, action] of this.shortcuts) {
			if (this.eventMatches(event, binding)) {
				event.preventDefault();
				console.debug("found matching binding", binding);
				action(event);
				return;
			}
		}
	}

	private eventMatches(event: KeyboardEvent, binding: KeyBinding) {
		return (
			event.code === binding.code &&
			(binding.ctrlKey === undefined || event.ctrlKey === binding.ctrlKey) &&
			(binding.shiftKey === undefined || event.shiftKey === binding.shiftKey)
		);
	}
}

export const RoomKeyboardShortcutsKey: InjectionKey<KeyboardShortcuts> = Symbol("room:keyboard");

interface KeyBinding {
	shiftKey?: boolean;
	ctrlKey?: boolean;
	code: string;
}

export function useRoomKeyboardShortcuts(): KeyboardShortcuts | undefined {
	return inject(RoomKeyboardShortcutsKey);
}
