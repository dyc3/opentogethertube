import { describe, expect, it, vi } from "vitest";
import type { QueueItem } from "ott-common/models/video";
import NowPlaying from "@/components/NowPlaying.vue";
import { flush, mountComponent } from "./component-test-utils";

const video: QueueItem = {
	service: "direct",
	id: "https://example.com/video.mp4",
	title: "video.mp4",
	description: "Full Link: https://example.com/video.mp4",
	length: 100,
};

type Wrapper = ReturnType<typeof mountComponent>["wrapper"];

/** The details are teleported out of the component, so they have to be found on the document. */
async function openDetails(wrapper: Wrapper) {
	await wrapper.get('[data-cy="now-playing"]').trigger("click");
	await flush();
	const details = document.querySelector('[data-cy="now-playing-details"]');
	expect(details).not.toBeNull();
	return details as HTMLElement;
}

describe("NowPlaying component", () => {
	it("shows the video's title", () => {
		const { wrapper } = mountComponent(NowPlaying, { props: { video } });

		expect(wrapper.get('[data-cy="now-playing"]').text()).toContain("video.mp4");
	});

	it("falls back to the video's id when it has no title", () => {
		const { wrapper } = mountComponent(NowPlaying, {
			props: { video: { service: "youtube", id: "dQw4w9WgXcQ" } },
		});

		expect(wrapper.get('[data-cy="now-playing"]').text()).toContain("dQw4w9WgXcQ");
	});

	it("follows the room to the next video", async () => {
		const { wrapper } = mountComponent(NowPlaying, { props: { video } });

		await wrapper.setProps({ video: { ...video, title: "next.mp4" } });

		expect(wrapper.get('[data-cy="now-playing"]').text()).toContain("next.mp4");
	});

	it("shows the description and length in the details", async () => {
		const { wrapper } = mountComponent(NowPlaying, { props: { video } });

		const details = await openDetails(wrapper);

		expect(details.textContent).toContain("Full Link: https://example.com/video.mp4");
		expect(details.textContent).toContain("01:40");
	});

	it("says so when the video has no description", async () => {
		const { wrapper } = mountComponent(NowPlaying, {
			props: { video: { ...video, description: "" } },
		});

		const details = await openDetails(wrapper);

		expect(details.textContent).toContain("No description.");
	});

	it("links to the original video", async () => {
		const { wrapper } = mountComponent(NowPlaying, {
			props: { video: { service: "youtube", id: "dQw4w9WgXcQ", title: "Foo" } },
		});

		const details = await openDetails(wrapper);

		const link = details.querySelector('[data-cy="now-playing-open-original"]');
		expect(link?.getAttribute("href")).toBe("https://youtu.be/dQw4w9WgXcQ");
		expect(link?.getAttribute("target")).toBe("_blank");
	});

	it("copies the original video's link to the clipboard", async () => {
		const writeText = vi.fn();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const { wrapper } = mountComponent(NowPlaying, { props: { video } });

		const details = await openDetails(wrapper);
		const button = details.querySelector<HTMLElement>('[data-cy="now-playing-copy-link"]');
		button?.click();
		await flush();

		expect(writeText).toHaveBeenCalledWith("https://example.com/video.mp4");
		expect(button?.textContent).toContain("Copied");
	});

	it("offers no links for a service whose videos can't be linked back to", async () => {
		const { wrapper } = mountComponent(NowPlaying, {
			props: { video: { service: "peertube", id: "example.com:abc", title: "Foo" } },
		});

		const details = await openDetails(wrapper);

		expect(details.querySelector('[data-cy="now-playing-open-original"]')).toBeNull();
		expect(details.querySelector('[data-cy="now-playing-copy-link"]')).toBeNull();
	});
});
