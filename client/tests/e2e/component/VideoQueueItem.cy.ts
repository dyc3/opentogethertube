import { defineComponent, h } from "vue";
import VideoQueueItem from "../../../src/components/VideoQueueItem.vue";
import { QueueItem } from "ott-common/models/video";
import { QueueMode } from "ott-common/models/types";
import _ from "lodash";

describe("<VideoQueueItem />", () => {
	it("should render basic metadata regardless of isPreview and queue mode", () => {
		let video: QueueItem = {
			service: "youtube",
			id: "1",
			title: "Foo",
			description: "Bar",
			length: 100,
		};
		let page = defineComponent({
			setup() {
				return () =>
					h(VideoQueueItem, {
						item: video,
					});
			},
		});
		cy.mount(page);

		cy.get(".video-title").should("be.visible").should("have.text", video.title);
		cy.get(".description").should("be.visible").should("have.text", video.description);
		cy.get(".video-length").should("be.visible").should("have.text", "01:40");
	});

	describe("buttons that should be visible", () => {
		const video: QueueItem = {
			service: "youtube",
			id: "1",
			title: "Foo",
			description: "Bar",
			length: 100,
		};

		function assertButtonVisible(testId: string, expected: boolean) {
			cy.get(`[data-cy="${testId}"]`).should(expected ? "be.visible" : "not.exist");
		}

		for (const queueMode of [QueueMode.Manual, QueueMode.Loop]) {
			it(`should have add button and not have remove button if preview, and queue mode is ${queueMode}`, () => {
				cy.mount(VideoQueueItem, {
					props: {
						item: video,
						isPreview: true,
					},
				});
				cy.store().then(store => {
					store.state.room.queueMode = queueMode;
				});

				assertButtonVisible("btn-add-to-queue", true);
				assertButtonVisible("btn-remove-from-queue", false);
			});
		}

		for (const queueMode of [QueueMode.Manual, QueueMode.Loop]) {
			it(`should not have add button and have remove button if not preview, and queue mode is ${queueMode}`, () => {
				cy.mount(VideoQueueItem, {
					props: {
						item: video,
						isPreview: false,
					},
				});
				cy.store().then(store => {
					store.state.room.queueMode = queueMode;
				});

				assertButtonVisible("btn-add-to-queue", false);
				assertButtonVisible("btn-remove-from-queue", true);
			});
		}

		for (const queueMode of [QueueMode.Manual, QueueMode.Loop, QueueMode.Dj]) {
			for (const isPreview of [true, false]) {
				it(`should have play now button if queue mode is ${queueMode} and isPreview == ${isPreview}`, () => {
					cy.mount(VideoQueueItem, {
						props: {
							item: video,
							isPreview,
						},
					});
					cy.store().then(store => {
						store.state.room.queueMode = queueMode;
					});

					assertButtonVisible("btn-play-now", true);
				});
			}
		}

		it(`should never show move to top/bottom menu buttons if preview`, () => {
			cy.mount(VideoQueueItem, {
				props: {
					item: video,
					isPreview: true,
				},
			});

			for (const queueMode of [
				QueueMode.Manual,
				QueueMode.Vote,
				QueueMode.Loop,
				QueueMode.Dj,
			]) {
				cy.log(`queue mode: ${queueMode}`);
				cy.store().then(store => {
					store.state.room.queueMode = queueMode;
				});

				cy.get('[data-cy="btn-menu"]').click();
				assertButtonVisible("menu-btn-move-to-top", false);
				assertButtonVisible("menu-btn-move-to-bottom", false);
				cy.get('[data-cy="btn-menu"]').click();
			}
		});

		it(`should only show vote button in vote mode if not preview`, () => {
			cy.mount(VideoQueueItem, {
				props: { item: video, isPreview: false },
			});

			for (const queueMode of [
				QueueMode.Manual,
				QueueMode.Vote,
				QueueMode.Loop,
				QueueMode.Dj,
			]) {
				cy.log(`queue mode: ${queueMode}`);
				cy.store().then(store => {
					store.state.room.queueMode = queueMode;
				});

				assertButtonVisible("btn-vote", queueMode === QueueMode.Vote);
			}
		});

		it("should always have the menu button", () => {
			cy.mount(VideoQueueItem, {
				props: { item: video },
			});

			for (const queueMode of [
				QueueMode.Manual,
				QueueMode.Vote,
				QueueMode.Loop,
				QueueMode.Dj,
			]) {
				for (const isPreview of [true, false]) {
					cy.log(`queue mode: ${queueMode}, isPreview: ${isPreview}`);
					cy.store().then(store => {
						store.state.room.queueMode = queueMode;
					});
					cy.setProps({ isPreview });

					assertButtonVisible("btn-menu", true);
				}
			}
		});
	});

	it("should add the video to the queue", () => {
		cy.intercept("POST", "/api/room/foo/queue", { success: true }).as("addToQueue");
		const video: QueueItem = {
			service: "youtube",
			id: "1",
			title: "Foo",
			description: "Bar",
			length: 100,
		};

		cy.mount(VideoQueueItem, {
			props: {
				item: video,
				isPreview: true,
			},
		});
		cy.store().then(store => {
			store.state.room.name = "foo";
		});

		cy.get('[data-cy="btn-add-to-queue"]').click();

		cy.wait("@addToQueue").then(interception => {
			expect(interception.request.body).to.deep.equal(_.pick(video, ["service", "id"]));
		});
	});

	it("should remove the video from the queue", () => {
		cy.intercept("DELETE", "/api/room/foo/queue", { success: true }).as("removeFromQueue");
		const video: QueueItem = {
			service: "youtube",
			id: "1",
			title: "Foo",
			description: "Bar",
			length: 100,
		};

		cy.mount(VideoQueueItem, {
			props: {
				item: video,
				isPreview: false,
			},
		});
		cy.store().then(store => {
			store.state.room.name = "foo";
		});

		cy.get('[data-cy="btn-remove-from-queue"]').click();

		cy.wait("@removeFromQueue").then(interception => {
			expect(interception.request.body).to.deep.equal(_.pick(video, ["service", "id"]));
		});
	});
});
