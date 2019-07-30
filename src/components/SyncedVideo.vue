<template>
	<div class="iframe-container" :key="src">
		<youtube v-if="service == 'youtube'" fitParent resize :video-id="youtubeVideoId" ref="youtube" :playerVars="{ controls: 0 }"></youtube>
	</div>
</template>

<script>
import url from "url";

export default {
	name: "syncedvideo",
	props: {
		src: String,
		position: Number, // playback position
		width: [Number, String],
		height: [Number, String],
	},
	data() {
		return {
			service: '',
			youtubeVideoId: ''
		}
	},
	computed: {
		async playbackPercent() {
			return (await this.$refs.youtube.player.getCurrentTime()) / (await this.$refs.youtube.player.getDuration())
		}
	},
	methods: {
		updateSource() {
			if (!this.src) {
				this.service = "";
				return;
			}
			let srcURL = url.parse(this.src);
			if (srcURL.host.endsWith("youtube.com") || srcUrl.host.endsWith("youtu.be")) {
				this.service = "youtube";
				this.youtubeVideoId = this.$youtube.getIdFromUrl(srcURL.href);
			}
			else {
				console.log("unknown url, host", srcURL.host);
			}
		},
		play() {
			if (this.service == "youtube") {
				this.$refs.youtube.player.playVideo();
			}
		},
		pause() {
			if (this.service == "youtube") {
				this.$refs.youtube.player.pauseVideo();
			}
		},
		setVolume(value) {
			if (this.service == "youtube") {
				this.$refs.youtube.player.setVolume(value);
			}
		}
	},
	watch: {
		src(newSrc, oldSrc) {
			this.updateSource();
			if (this.$store.state.room.isPlaying) {
				this.play();
			}
		},
		async position(newPosition, oldPosition) {
			if (Math.abs(newPosition - await this.$refs.youtube.player.getCurrentTime()) > 1) {
				this.$refs.youtube.player.seekTo(newPosition);
			}
		}
	},
	mounted() {
		this.updateSource();
		this.$events.on("playVideo", eventData => {
			this.play();
		});
		this.$events.on("pauseVideo", eventData => {
			this.pause();
		});
	}
}
</script>

<style lang="scss" scoped>
.iframe-container {
	position: relative;
	padding-bottom: 56.25%;
	height: 0;
	overflow: hidden;
	max-width: 100%;
}
.iframe-container iframe {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
}
</style>