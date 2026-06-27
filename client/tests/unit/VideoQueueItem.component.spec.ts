import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueMode } from "ott-common/models/types";
import { RoomRequestType } from "ott-common/models/messages";
import type { QueueItem } from "ott-common/models/video";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import { flush, mountComponent } from "./component-test-utils";

const { API } = vi.hoisted(() => ({
	API: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/common-http", () => ({ API }));

const video: QueueItem = {
	service: "youtube",
	id: "1",
	title: "Foo",
	description: "Bar",
	length: 100,
};

function mountItem(props = {}) {
	const result = mountComponent(VideoQueueItem, { props: { item: video, ...props } });
	result.store.state.room.name = "foo";
	return result;
}

async function openMenu(wrapper: ReturnType<typeof mountItem>["wrapper"]) {
	await wrapper.get('[data-cy="btn-menu"]').trigger("click");
	await flush();
}

function selectorExists(wrapper: ReturnType<typeof mountItem>["wrapper"], selector: string) {
	return selector.startsWith('[data-cy="menu')
		? document.querySelector(selector) !== null
		: wrapper.find(selector).exists();
}

describe("VideoQueueItem component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders basic metadata", () => {
		const { wrapper } = mountItem();

		expect(wrapper.get(".video-title").text()).toBe(video.title);
		expect(wrapper.get(".description").text()).toBe(video.description);
		expect(wrapper.get(".video-length").text()).toBe("01:40");
	});

	it("shows add/remove/play/vote buttons for queue modes", async () => {
		for (const [queueMode, isPreview, visibleSelectors, hiddenSelectors] of [
			[
				QueueMode.Manual,
				true,
				[
					'[data-cy="btn-play-now"]',
					'[data-cy="btn-add-to-queue"]',
					'[data-cy="menu-btn-play-now"]',
				],
				[
					'[data-cy="btn-remove-from-queue"]',
					'[data-cy="btn-vote"]',
					'[data-cy="menu-btn-add-to-queue"]',
					'[data-cy="menu-btn-remove-from-queue"]',
				],
			],
			[
				QueueMode.Manual,
				false,
				[
					'[data-cy="btn-play-now"]',
					'[data-cy="btn-remove-from-queue"]',
					'[data-cy="menu-btn-play-now"]',
					'[data-cy="menu-btn-move-to-top"]',
					'[data-cy="menu-btn-move-to-bottom"]',
				],
				['[data-cy="btn-add-to-queue"]', '[data-cy="btn-vote"]'],
			],
			[
				QueueMode.Loop,
				false,
				[
					'[data-cy="btn-play-now"]',
					'[data-cy="btn-remove-from-queue"]',
					'[data-cy="menu-btn-move-to-top"]',
					'[data-cy="menu-btn-move-to-bottom"]',
				],
				['[data-cy="btn-add-to-queue"]', '[data-cy="btn-vote"]'],
			],
			[
				QueueMode.Dj,
				true,
				['[data-cy="btn-play-now"]', '[data-cy="menu-btn-add-to-queue"]'],
				[
					'[data-cy="btn-add-to-queue"]',
					'[data-cy="btn-remove-from-queue"]',
					'[data-cy="btn-vote"]',
				],
			],
			[
				QueueMode.Dj,
				false,
				['[data-cy="btn-play-now"]', '[data-cy="menu-btn-remove-from-queue"]'],
				[
					'[data-cy="btn-add-to-queue"]',
					'[data-cy="btn-remove-from-queue"]',
					'[data-cy="btn-vote"]',
					'[data-cy="menu-btn-move-to-top"]',
				],
			],
			[
				QueueMode.Vote,
				false,
				['[data-cy="btn-vote"]', '[data-cy="btn-remove-from-queue"]'],
				[
					'[data-cy="btn-play-now"]',
					'[data-cy="btn-add-to-queue"]',
					'[data-cy="menu-btn-play-now"]',
					'[data-cy="menu-btn-move-to-top"]',
					'[data-cy="menu-btn-move-to-bottom"]',
				],
			],
		] as const) {
			document
				.querySelectorAll(".v-overlay-container")
				.forEach(container => container.remove());
			const { wrapper, store } = mountItem({ isPreview });
			store.commit("room/SYNC", { queueMode });
			await wrapper.vm.$nextTick();

			await openMenu(wrapper);

			for (const selector of visibleSelectors) {
				expect(
					selectorExists(wrapper, selector),
					`${queueMode} ${isPreview ? "preview" : "queued"} should show ${selector}`,
				).toBe(true);
			}
			for (const selector of hiddenSelectors) {
				expect(
					selectorExists(wrapper, selector),
					`${queueMode} ${isPreview ? "preview" : "queued"} should hide ${selector}`,
				).toBe(false);
			}
		}
	});

	it("adds preview video to the queue", async () => {
		API.post.mockResolvedValue({ data: { success: true } });
		const { wrapper, store } = mountItem({ isPreview: true });
		store.commit("room/SYNC", { queueMode: QueueMode.Manual });
		await wrapper.vm.$nextTick();

		await wrapper.get('[data-cy="btn-add-to-queue"]').trigger("click");
		await flush();

		expect(API.post).toHaveBeenCalledWith("/room/foo/queue", {
			service: "youtube",
			id: "1",
			defaultSubtitleTrack: null,
		});
	});

	it("adds preview video with defaultSubtitleTrack", async () => {
		API.post.mockResolvedValue({ data: { success: true } });
		const directVideo = {
			...video,
			service: "direct",
			defaultSubtitleTrack: "https://example.com/subtitles.vtt",
		};
		const { wrapper, store } = mountComponent(VideoQueueItem, {
			props: { item: directVideo, isPreview: true },
		});
		store.state.room.name = "foo";
		store.commit("room/SYNC", { queueMode: QueueMode.Manual });
		await wrapper.vm.$nextTick();

		await wrapper.get('[data-cy="btn-add-to-queue"]').trigger("click");
		await flush();

		expect(API.post).toHaveBeenCalledWith("/room/foo/queue", {
			service: "direct",
			id: "1",
			defaultSubtitleTrack: "https://example.com/subtitles.vtt",
		});
	});

	it("removes video from queue", async () => {
		API.delete.mockResolvedValue({ data: { success: true } });
		const { wrapper, store } = mountItem({ isPreview: false });
		store.commit("room/SYNC", { queueMode: QueueMode.Manual });
		await wrapper.vm.$nextTick();

		await wrapper.get('[data-cy="btn-remove-from-queue"]').trigger("click");
		await flush();

		expect(API.delete).toHaveBeenCalledWith("/room/foo/queue", {
			data: { service: "youtube", id: "1", defaultSubtitleTrack: null },
		});
	});

	it("always has menu button and hides drag handle for preview", async () => {
		const { wrapper } = mountItem({ isPreview: true });
		expect(wrapper.find('[data-cy="btn-menu"]').exists()).toBe(true);
		expect(wrapper.find(".drag-handle").exists()).toBe(false);

		await wrapper.setProps({ isPreview: false });
		expect(wrapper.find('[data-cy="btn-menu"]').exists()).toBe(true);
		expect(wrapper.find(".drag-handle").exists()).toBe(true);
	});

	it("moves queued videos to the top and bottom from the menu", async () => {
		const { wrapper, store, connection } = mountItem({ isPreview: false, index: 1 });
		store.commit("room/SYNC", { queueMode: QueueMode.Manual });
		store.state.room.queue = [video, { ...video, id: "2" }, { ...video, id: "3" }];
		await wrapper.vm.$nextTick();
		await openMenu(wrapper);

		(document.querySelector('[data-cy="menu-btn-move-to-top"]') as HTMLElement).click();
		(document.querySelector('[data-cy="menu-btn-move-to-bottom"]') as HTMLElement).click();

		expect(connection.sent).toEqual([
			{
				action: "req",
				request: { type: RoomRequestType.OrderRequest, fromIdx: 1, toIdx: 0 },
			},
			{
				action: "req",
				request: { type: RoomRequestType.OrderRequest, fromIdx: 1, toIdx: 2 },
			},
		]);
	});

	it("shows an error when saving an invalid subtitle URL", async () => {
		API.patch.mockResolvedValue({ data: { success: false } });
		const directVideo = {
			...video,
			service: "direct",
			defaultSubtitleTrack: "https://example.com/subtitles.vtt",
		};
		const { wrapper, store } = mountComponent(VideoQueueItem, {
			props: { item: directVideo, isPreview: false },
		});
		store.state.room.name = "foo";

		await openMenu(wrapper);
		(document.querySelector('[data-cy="menu-btn-edit-preview"]') as HTMLElement).click();
		await flush();
		const input = document.querySelector('[data-cy="edit-subtitle-url"]') as HTMLInputElement;
		input.value = "not a url";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		(document.querySelector('[data-cy="edit-save"]') as HTMLElement).click();
		await flush();

		expect(API.patch).toHaveBeenCalledWith("/room/foo/queue", {
			service: "direct",
			id: "1",
			defaultSubtitleTrack: "not a url",
		});
		expect(wrapper.find('[data-cy="btn-remove-from-queue"] svg').exists()).toBe(true);
	});
});
