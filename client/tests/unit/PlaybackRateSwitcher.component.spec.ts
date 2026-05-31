import { describe, expect, it } from "vitest";
import PlaybackRateSwitcher from "@/components/controls/PlaybackRateSwitcher.vue";
import { usePlaybackRate } from "@/components/composables";
import { mountComponent } from "./component-test-utils";

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
		const playbackRate = usePlaybackRate();
		playbackRate.availablePlaybackRates.value = PLAYBACK_RATES.map(r => r[0]);
		playbackRate.playbackRate.value = rate;

		const { wrapper } = mountComponent(PlaybackRateSwitcher);

		expect(wrapper.get('button[aria-label="Playback Speed"]').text()).toEqual(formatted);
	});
});
