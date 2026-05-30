import { mount, type MountingOptions } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import type { Component } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import type { Store } from "vuex";
import { afterEach } from "vitest";
import vuetify from "@/plugins/vuetify";
import { i18n } from "@/i18n";
import { routes } from "@/router";
import { buildNewStore, key, type FullOTTStoreState } from "@/store";
import { OttRoomConnectionMock, connectionInjectKey } from "@/plugins/connection";
import { OttSfx, sfxInjectKey } from "@/plugins/sfx";
import toast from "@/util/toast";

const wrappers: VueWrapper[] = [];

export function mountComponent(component: Component, options: MountingOptions<any> = {}) {
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

	const wrapper = mount(component as any, {
		attachTo: root,
		...options,
		global: {
			...options.global,
			plugins: [vuetify, [store, key], i18n, router, ...(options.global?.plugins ?? [])],
			provide: {
				[connectionInjectKey as symbol]: connection,
				[sfxInjectKey as symbol]: sfx,
				...options.global?.provide,
			},
		},
	});
	wrappers.push(wrapper);

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
