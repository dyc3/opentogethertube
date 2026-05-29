<template>
	<div class="add-video-helper">
		<h1 class="font-display text-3xl tracking-wide text-primary text-glow-primary">
			{{ $t("add-preview.title") }}
		</h1>
		<h3 class="label-mono mt-4 text-signal">{{ $t("add-preview.single-videos") }}</h3>
		<ul>
			<li>
				<ProcessedText
					:text="
						$t('add-preview.platforms.youtube-videos', {
							url: 'https://youtube.com/watch?v=LP8GRjv6AIo',
						})
					"
					@link-click="setAddPreviewText"
				/>
			</li>
			<li>
				<ProcessedText
					:text="
						$t('add-preview.platforms.vimeo-videos', {
							url: 'https://vimeo.com/94338566',
						})
					"
					@link-click="setAddPreviewText"
				/>
			</li>
			<li>
				<ProcessedText
					:text="
						$t('add-preview.platforms.any-mp4-videos', {
							url: 'https://vjs.zencdn.net/v/oceans.mp4',
						})
					"
					@link-click="setAddPreviewText"
				/>
			</li>
		</ul>
		<h3 class="label-mono mt-4 text-signal">{{ $t("add-preview.playlists") }}</h3>
		<ul>
			<li>
				<ProcessedText
					:text="
						$t('add-preview.platforms.youtube-playlists', {
							url: 'https://youtube.com/playlist?list=PLv-kM7bcufALqOQvMsrVCQCEL1pIWScoQ',
						})
					"
					@link-click="setAddPreviewText"
				/>
			</li>
			<li>
				<ProcessedText
					:text="
						$t('add-preview.platforms.youtube-channels', {
							url: 'https://youtube.com/channel/UCI1XS_GkLGDOgf8YLaaXNRA',
						})
					"
					@link-click="setAddPreviewText"
				/>
			</li>
		</ul>
		<span class="text-sm text-muted-foreground">{{ $t("add-preview.text") }}</span>
	</div>
</template>

<script lang="ts" setup>
import { defineEmits } from "vue";
import ProcessedText from "./ProcessedText.vue";

const emit = defineEmits<{
	"link-click": [url: string];
}>();

function setAddPreviewText(url: string) {
	emit("link-click", url);
}
</script>

<style lang="scss" scoped>
.add-video-helper {
	width: 400px;
	@media (max-width: 600px) {
		width: 80%;
	}

	h1 {
		width: 100%;
		text-align: center;
	}

	ul {
		margin: 8px 0 4px;
		padding-left: 1.1rem;
		list-style: none;
	}

	li {
		position: relative;
		padding: 3px 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-line-clamp: 1;
		color: var(--muted-foreground);

		&::before {
			content: "›";
			position: absolute;
			left: -1rem;
			color: var(--primary);
		}
	}
}
</style>
