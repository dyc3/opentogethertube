import { inject, InjectionKey, onUnmounted } from "vue";
import _ from "lodash";

const BINDING_DEFAULTS = {
	ctrlKey: false,
	shiftKey: false,
};

export class KeyboardShortcuts {
	shortcuts: [KeyBindingStrict, (event: KeyboardEvent) => void][] = [];

	bind(binding: KeyBinding | KeyBinding[], action: (event: KeyboardEvent) => void) {
		if (Array.isArray(binding)) {
			for (let b of binding) {
				this.bind(b, action);
			}
		} else {
			let bindStrict: KeyBindingStrict = _.defaults(binding, BINDING_DEFAULTS);

			// don't allow duplicate bindings
			for (let [b] of this.shortcuts) {
				if (_.isEqual(b, bindStrict)) {
					console.warn("duplicate keyboard shortcut binding", bindStrict);
					return;
				}
			}

			this.shortcuts.push([bindStrict, action]);

			try {
				onUnmounted(() => {
					this.unbind(binding);
				});
			} catch (e) {
				console.warn("could not set up onUnmounted hook for keybind", binding, e);
			}
		}
	}

	unbind(binding: KeyBinding) {
		let bindStrict: KeyBindingStrict = _.defaults(binding, BINDING_DEFAULTS);

		this.shortcuts = this.shortcuts.filter(s => {
			return !_.isEqual(s[0], bindStrict);
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

	private eventMatches(event: KeyboardEvent, binding: KeyBindingStrict) {
		return (
			event.code === binding.code &&
			event.ctrlKey === binding.ctrlKey &&
			event.shiftKey === binding.shiftKey
		);
	}
}

export const RoomKeyboardShortcutsKey: InjectionKey<KeyboardShortcuts> = Symbol("room:keyboard");

interface KeyBinding {
	shiftKey?: boolean;
	ctrlKey?: boolean;
	code: string;
}

interface KeyBindingStrict {
	shiftKey: boolean;
	ctrlKey: boolean;
	code: string;
}

export function useRoomKeyboardShortcuts(): KeyboardShortcuts | undefined {
	return inject(RoomKeyboardShortcutsKey);
}
