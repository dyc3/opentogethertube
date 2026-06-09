import { beforeEach, describe, expect, it } from "../support/fixtures";

const QUALITY_BUTTON_PATTERN = /Quality/;

describe("Video playback", () => {
	const youtubePlayerSelector = '[data-cy="youtube-player"] iframe';

	beforeEach(async ({ page, ott }) => {
		page.on("pageerror", () => {
			// Embedded player scripts can throw after load; these tests assert our UI state.
		});
		await ott.ensureToken();
		await ott.resetRateLimit();
		const response = await ott.request({ method: "POST", url: "/api/room/generate" });
		const body = await response.json();
		await page.goto(`/room/${body.room}`);
	});

	async function addVideo(page, url: string) {
		await page.getByRole("button", { name: "Add a video" }).click();
		await page.locator('[data-cy="add-preview-input"]').fill(url);
		await page.locator(".video button").nth(1).click();
	}

	async function expectPaused(page, paused: boolean) {
		await expect
			.poll(() => page.locator("video").evaluate(video => (video as HTMLVideoElement).paused))
			.toBe(paused);
	}

	async function expectCurrentTime(page, time: number) {
		await expect
			.poll(() =>
				page.locator("video").evaluate(video => (video as HTMLVideoElement).currentTime),
			)
			.toBeCloseTo(time, 0);
	}

	async function clickMenuItem(page, name: string) {
		await page
			.getByRole("menuitem", { name })
			.evaluate(element => (element as HTMLElement).click());
	}

	it("should add and play a youtube video", async ({ page }) => {
		it.skip(!!process.env.CI && !process.env.YOUTUBE_API_KEY, "YOUTUBE_API_KEY is not set");

		await addVideo(page, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		await expect(page.locator(youtubePlayerSelector)).toBeVisible({ timeout: 15000 });
		await expect
			.poll(() =>
				page
					.frameLocator(youtubePlayerSelector)
					.locator("video")
					.evaluate(video => (video as HTMLVideoElement).paused),
			)
			.toBe(true);

		await page.locator(".video-controls button").nth(1).click();
		await expect
			.poll(() =>
				page
					.frameLocator(youtubePlayerSelector)
					.locator("video")
					.evaluate(video => (video as HTMLVideoElement).paused),
			)
			.toBe(false);
	});

	it("should add and play a direct video", async ({ page }) => {
		await addVideo(page, "https://vjs.zencdn.net/v/oceans.mp4");
		await expect(page.locator("video")).toBeVisible();
		await expectPaused(page, true);
		await page.locator(".video-controls button").nth(1).click();
		await expectPaused(page, false);
	});

	it("should synchronize direct video playback between viewers", async ({
		browser,
		page,
		request,
	}) => {
		const roomUrl = page.url();
		const tokenResponse = await request.get("/api/auth/grant");
		expect(tokenResponse.ok()).toBe(true);
		const tokenBody = await tokenResponse.json();

		const secondContext = await browser.newContext();
		await secondContext.addInitScript(token => {
			window.localStorage.setItem("token", token as string);
		}, tokenBody.token);
		const secondPage = await secondContext.newPage();

		try {
			await secondPage.goto(roomUrl);
			await expect(secondPage.locator("#connectStatus")).toHaveText("Connected");

			await addVideo(page, "https://vjs.zencdn.net/v/oceans.mp4");
			await expect(page.locator("video")).toBeVisible();
			await expect(secondPage.locator("video")).toBeVisible();
			await expectPaused(page, true);
			await expectPaused(secondPage, true);

			await page.locator('[data-cy="timestamp-display"] .editable').click();
			await page.locator('[data-cy="timestamp-display"] .editor').fill("10");
			await page.locator('[data-cy="timestamp-display"] .editor').press("Enter");
			await expectCurrentTime(page, 10);
			await expectCurrentTime(secondPage, 10);

			await page.locator(".video-controls button").nth(1).click();
			await expectPaused(page, false);
			await expectPaused(secondPage, false);

			await page.locator(".video-controls button").nth(1).click();
			await expectPaused(page, true);
			await expectPaused(secondPage, true);
		} finally {
			await secondContext.close();
		}
	});

	it("should add a direct video and control it in various ways", async ({ page, ott }) => {
		await addVideo(page, "https://vjs.zencdn.net/v/oceans.mp4");
		await expect(page.locator("video")).toBeVisible();
		await expectPaused(page, true);

		await ott.sliderMove(page.locator("#videoSlider"), 0.1);
		await expect
			.poll(() =>
				page.locator("video").evaluate(video => (video as HTMLVideoElement).currentTime),
			)
			.toBeGreaterThan(0);

		await page.locator('[data-cy="timestamp-display"] .editable').click();
		await page.locator('[data-cy="timestamp-display"] .editor').fill("10");
		await page.locator('[data-cy="timestamp-display"] .editor').press("Enter");
		await expect
			.poll(() =>
				page.locator("video").evaluate(video => (video as HTMLVideoElement).currentTime),
			)
			.toBe(10);

		await ott.sliderMove(page.locator('[data-cy="volume-slider"]'), 0.4);
		await expect
			.poll(() => page.locator("video").evaluate(video => (video as HTMLVideoElement).volume))
			.toBeCloseTo(0.4, 1);
	});

	it("should add a hls video and control its playback rate in various ways", async ({
		page,
		ott,
	}) => {
		await addVideo(
			page,
			"https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
		);
		await expect(page.locator("video")).toBeVisible();
		await expectPaused(page, true);
		await ott.closeToasts();

		await expect(page.getByLabel("Playback Speed")).toBeEnabled();
		await expect(page.getByLabel("Subtitles/CC")).toBeVisible();
		await expect(page.getByLabel("Player settings")).toBeEnabled();

		await page.getByLabel("Playback Speed").click();
		await clickMenuItem(page, "1.5x");
		await expect
			.poll(() =>
				page.locator("video").evaluate(video => (video as HTMLVideoElement).playbackRate),
			)
			.toBe(1.5);

		await page.locator(".video-controls button").nth(1).click();
		await expectPaused(page, false);

		await page.getByLabel("Playback Speed").click();
		await clickMenuItem(page, "2x");
		await expect
			.poll(() =>
				page.locator("video").evaluate(video => (video as HTMLVideoElement).playbackRate),
			)
			.toBe(2);

		await page.getByLabel("Playback Speed").click();
		await clickMenuItem(page, "1x");
		await expect
			.poll(() =>
				page.locator("video").evaluate(video => (video as HTMLVideoElement).playbackRate),
			)
			.toBe(1);
	});

	const testVideos = [
		"https://mtoczko.github.io/hls-test-streams/test-vtt/playlist.m3u8",
		"https://vjs.zencdn.net/v/oceans.mp4",
	];

	testVideos.forEach((url, i) => {
		it(`should add a couple videos and properly update the UI for things that are implemented for the current video player [${i}]`, async ({
			page,
			ott,
		}) => {
			await addVideo(page, "https://vimeo.com/94338566");
			await page.locator('[data-cy="add-preview-input"]').fill(url);
			await page.locator(".video button").nth(1).click();
			await expect(page.locator("iframe")).toBeVisible();
			await ott.closeToasts();

			await expect(page.getByLabel("Playback Speed")).toBeDisabled();
			await expect(page.getByLabel("Subtitles/CC")).toBeDisabled();
			await expect(page.getByLabel("Player settings")).toBeEnabled();
			await page.getByLabel("Player settings").click();
			await expect(
				page.getByRole("button", { name: "Subtitles/CC disabled" }),
			).toBeDisabled();
			await expect(page.getByRole("button", { name: "Quality disabled" })).toBeDisabled();

			await page.locator(".video-controls button").nth(3).click();
			await expect(page.locator("video")).toBeVisible();
			await expectPaused(page, true);

			await expect(page.getByLabel("Playback Speed")).toBeEnabled();
			const isHlsVideo = i === 0;
			if (isHlsVideo) {
				await expect(page.getByLabel("Subtitles/CC")).toBeEnabled();
			} else {
				await expect(page.getByLabel("Subtitles/CC")).toBeDisabled();
			}

			await expect(page.getByLabel("Player settings")).toBeEnabled();
			await page.getByLabel("Player settings").click();
			if (isHlsVideo) {
				await expect(
					page.getByRole("button", { name: QUALITY_BUTTON_PATTERN }),
				).toBeEnabled();
			} else {
				await expect(
					page.getByRole("button", { name: "Subtitles/CC disabled" }),
				).toBeDisabled();
				await expect(page.getByRole("button", { name: "Quality disabled" })).toBeDisabled();
			}

			await page.locator(".video-controls button").nth(3).click();
			await expect(page.locator("video")).toHaveCount(0);
			await expect(page.getByLabel("Playback Speed")).toBeDisabled();
			await expect(page.getByLabel("Subtitles/CC")).toBeDisabled();
			await expect(page.getByLabel("Player settings")).toBeEnabled();
			await page.getByLabel("Player settings").click();
			await expect(
				page.getByRole("button", { name: "Subtitles/CC disabled" }),
			).toBeDisabled();
			await expect(page.getByRole("button", { name: "Quality disabled" })).toBeDisabled();
		});
	});
});
