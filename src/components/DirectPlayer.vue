<template>
	<div class="direct">
		<video id="directplayer" class="video-js vjs-default-skin" :key="videoUrl">
		</video>
	</div>
</template>

<script>
import videojs from "video.js";

export default {
	name: "DirectPlayer",
	props: {
		videoUrl: { type: String, required: true },
		videoMime: { type: String, required: true },
		thumbnail: { type: String },
	},
	data() {
		return {
			player: null,
		};
	},
	mounted() {
		this.player = videojs(document.getElementById("directplayer"), {
			controls: false,
			responsive: true,
			loop: false,
			preload: "auto",
			poster: this.thumbnail,
		});
		if (process.env.NODE_ENV === "development") {
			for (const event of [
				"ready",
				"loadstart",
				"suspend",
				"abort",
				"error",
				"emptied",
				"stalled",
				"loadedmetadata",
				"loadeddata",
				"canplay",
				"canplaythrough",
				"playing",
				"waiting",
				"seeking",
				"seeked",
				"ended",
				"durationchange",
				"timeupdate",
				"progress",
				"play",
				"pause",
				"ratechange",
				"resize",
				"volumechange",
			]) {
				this.player.on(event, () => console.log("DirectPlayer event:", event));
			}
			videojs.log.level("debug");
		}
		this.player.on("ready", () => this.$emit("ready"));
		this.player.on("ended", () => this.$emit("end"));
		this.player.on("playing", () => this.$emit("playing"));
		this.player.on("pause", () => this.$emit("paused"));
		this.player.on("play", () => this.$emit("waiting"));
		this.player.on("stalled", () => this.$emit("buffering"));
		this.player.on("error", () => this.$emit("error"));
		this.player.on("progress", () => {
			this.$emit("buffer-progress", this.player.bufferedPercent());
			this.$emit("buffer-spans", this.player.buffered());
		});
		this.loadVideoSource();
		this.player.load();
	},
	beforeDestroy() {
		if (this.player) {
			this.player.dispose();
		}
	},
	methods: {
		play() {
			return this.player.play();
		},
		pause() {
			return this.player.pause();
		},
		setVolume(volume) {
			return this.player.volume(volume / 100);
		},
		getPosition() {
			return this.player.currentTime();
		},
		setPosition(position) {
			return this.player.currentTime(position);
		},
		loadVideoSource() {
			this.player.src({
				src: this.videoUrl,
				type: this.videoMime,
			});
		},
	},
	watch: {
		videoUrl() {
			this.loadVideoSource();
		},
	},
};
</script>

<style lang="scss" scoped>
@import url("https://vjs.zencdn.net/5.4.6/video-js.min.css");

.video-js {
	width: 100%;
	height: 100%;
}
</style>
