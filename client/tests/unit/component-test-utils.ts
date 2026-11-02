import { mount, type MountingOptions } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { defineComponent, h, reactive, type Component } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { i18n } from "@/i18n";
import { routes } from "@/router";
import { buildNewStore, key } from "@/store";
import { OttRoomConnectionMock, connectionInjectKey } from "@/plugins/connection";
import { OttSfx, sfxInjectKey } from "@/plugins/sfx";
import toast from "@/util/toast";

const wrappers: VueWrapper[] = [];

/** In-memory stand-in for `localStorage`. */
class MemoryStorage implements Storage {
	private items = new Map<string, string>();

	get length() {
		return this.items.size;
	}

	clear() {
		this.items.clear();
	}

	getItem(key: string) {
		return this.items.get(key) ?? null;
	}

	key(index: number) {
		return [...this.items.keys()][index] ?? null;
	}

	removeItem(key: string) {
		this.items.delete(key);
	}

	setItem(key: string, value: string) {
		this.items.set(key, String(value));
	}
}

export function mountComponent(
	component: Component,
	options: MountingOptions<Record<string, unknown>> = {},
) {
	if (!window.AudioContext) {
		window.AudioContext = class {
			createGain() {
				return { connect: () => undefined };
			}
		} as unknown as typeof AudioContext;
	}
	if (!window.ResizeObserver) {
		window.ResizeObserver = class {
			observe() {
				return undefined;
			}
			unobserve() {
				return undefined;
			}
			disconnect() {
				return undefined;
			}
		} as unknown as typeof ResizeObserver;
	}
	// Node 25+ defines its own `localStorage` global, which shadows jsdom's and is undefined
	// unless Node is started with `--localstorage-file`.
	if (!globalThis.localStorage) {
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
	}
	if (!window.visualViewport) {
		Object.defineProperty(window, "visualViewport", {
			configurable: true,
			value: {
				width: 1024,
				height: 768,
				offsetLeft: 0,
				offsetTop: 0,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
			},
		});
	}

	const store = buildNewStore();
	toast.setStore(store);
	const connection = new OttRoomConnectionMock();
	const router = createRouter({
		routes,
		history: createMemoryHistory(),
	});
	const sfx = new OttSfx();
	const root = document.createElement("div");
	document.body.appendChild(root);

	const childProps = reactive({ ...(options.props ?? {}) });
	const host = defineComponent({
		setup() {
			return () =>
				h(TooltipProvider, null, {
					default: () => h(component, childProps, options.slots ?? {}),
				});
		},
	});

	const hostWrapper = mount(host, {
		attachTo: root,
		global: {
			...options.global,
			plugins: [[store, key], i18n, router, ...(options.global?.plugins ?? [])],
			provide: {
				[connectionInjectKey as symbol]: connection,
				[sfxInjectKey as symbol]: sfx,
				...options.global?.provide,
			},
		},
	});
	const wrapper = hostWrapper.getComponent(component);
	const setProps = wrapper.setProps.bind(wrapper);
	wrapper.setProps = async props => {
		try {
			await setProps(props);
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes("mounted component")) {
				throw error;
			}
			Object.assign(childProps, props);
			await hostWrapper.vm.$nextTick();
		}
	};
	wrappers.push(hostWrapper);

	return { wrapper, store, connection, router };
}

export async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

// Shared test helpers own cleanup for every spec that mounts a component.
// eslint-disable-next-line vitest/require-top-level-describe
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) {
		wrapper.unmount();
	}
	document.body.innerHTML = "";
});
