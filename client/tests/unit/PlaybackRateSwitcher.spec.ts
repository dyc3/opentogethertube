import { it, describe, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PlaybackRateSwitcher from "@/components/controls/PlaybackRateSwitcher.vue";
import { i18n } from "@/i18n";
import { createVuetify } from "vuetify";
import { MockOttRoomConnectionPlugin } from "@/plugins/connection";

const mountOptions = {
	global: {
		plugins: [createVuetify(), i18n, MockOttRoomConnectionPlugin],
	},
};

describe("PlaybackRateSwitcher component", () => {
	const PLAYBACK_RATES: [number, string][] = [
		[0.25, "0.25x"],
		[1 / 3, "0.33x"],
		[0.5, "0.5x"],
		[2 / 3, "0.67x"],
		[0.75, "0.75x"],
		[1, "1x"],
		[1.25, "1.25x"],
		[1.5, "1.5x"],
		[1.75, "1.75x"],
		[2, "2x"],
	];
	it.each(PLAYBACK_RATES)("should format rate %s correctly", (rate, formatted) => {
		let wrapper = mount(PlaybackRateSwitcher, {
			...mountOptions,
			props: {
				currentRate: rate,
				availableRates: PLAYBACK_RATES.map(r => r[0]),
			},
			mounted: vi.fn(),
		});
		expect(wrapper.vm.$el.textContent.trim()).toEqual(formatted);
	});
});
