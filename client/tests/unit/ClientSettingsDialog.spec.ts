import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, buildNewStore } from "../../src/store";
import { i18n } from "../../src/i18n";
import ClientSettingsDialog from "../../src/components/ClientSettingsDialog.vue";

vi.mock("../../src/plugins/sfx", async () => {
	const { ref } = await import("vue");

	return {
		useSfx: () => ({
			enabled: true,
			volume: ref(0.8),
		}),
	};
});

describe("ClientSettingsDialog", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders client setting controls without setup errors", () => {
		const store = buildNewStore();
		const wrapper = mount(ClientSettingsDialog, {
			global: {
				plugins: [[store, key], i18n],
				stubs: {
					VDialog: {
						template: '<div><slot name="activator" :props="{}" /><slot /></div>',
					},
					VCard: { template: "<div><slot /></div>" },
					VCardTitle: { template: "<div><slot /></div>" },
					VCardText: { template: "<div><slot /></div>" },
					VDivider: { template: "<hr />" },
					VCardActions: { template: "<div><slot /></div>" },
					VSpacer: { template: "<div />" },
					VThemeProvider: { template: "<div><slot /></div>" },
					VListItem: { template: "<div />" },
					VExpandTransition: { template: "<div><slot /></div>" },
					VBtn: {
						emits: ["click"],
						template: "<button @click=\"$emit('click')\"><slot /></button>",
					},
					VSelect: {
						props: ["label"],
						template: '<div class="control-label">{{ label }}</div>',
					},
					VCheckbox: {
						props: ["label"],
						template: '<div class="control-label">{{ label }}</div>',
					},
					VSlider: {
						props: ["label", "hint"],
						template:
							'<div class="control-label">{{ label }}<span class="hint">{{ hint }}</span><slot name="append" /></div>',
					},
					AutoSkipSegmentSettings: { template: "<div />" },
				},
			},
		});

		const text = wrapper.text();

		expect(text).toContain("Preferences");
		expect(text).toContain("Room Layout");
		expect(text).toContain("Theme");
		expect(text).toContain("Audio Boost");
		expect(text).toContain("Enable Sound Effects");
		expect(text).toContain("Boost volume for supported players");
	});
});
