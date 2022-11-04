<template>
	<div class="generichls">
		<video id="generichlsplayer" class="video-js vjs-default-skin" :key="videoid"></video>
	</div>
</template>

<script>
import videojs from "video.js";

export default {
	name: "GenericHlsPlayer",
	props: {
		videoid: { type: String, required: true },
		hlsUrl: { type: String, required: true },
		thumbnail: { type: String },
	},
	data() {
		return {
			player: null,

			hasEmittedApiReady: false,
			videoUrl: "",
		};
	},
	mounted() {
		this.beginNewVideo();
	},
	beforeDestroy() {
		if (this.player) {
			this.player.dispose();
		}
	},
	methods: {
		play() {
			console.log("GenericHlsPlayer: play()");
			return this.player.play();
		},
		pause() {
			console.log("GenericHlsPlayer: pause()");
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
		async loadVideoSource() {
			console.log("GenericHlsPlayer: loading video source:", this.hlsUrl);

			this.player.src({
				src: this.hlsUrl,
				type: "application/x-mpegurl",
			});
			this.player.load();
			if (this.$store.state.room.isPlaying) {
				this.player.play();
			}
		},
		beginNewVideo() {
			this.player = videojs(document.getElementById("generichlsplayer"), {
				controls: false,
				responsive: true,
				loop: false,
				preload: "auto",
				poster: this.thumbnail,
			});
			// required for iOS
			// this.player.setPlaysinline(true);
			if (!this.hasEmittedApiReady) {
				this.$emit("apiready");
				this.hasEmittedApiReady = true;
			}
			if (import.meta.env.NODE_ENV === "development") {
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
					"playing",
					"waiting",
					"seeking",
					"seeked",
					"ended",
					"durationchange",
					"progress",
					"play",
					"pause",
					"ratechange",
				]) {
					this.player.on(event, () => console.log("TubiPlayer event:", event));
				}
				videojs.log.level("debug");
			}
			this.player.on("ready", () => this.$emit("ready"));
			this.player.on("ended", () => this.$emit("end"));
			this.player.on("ended", this.onVideoEnd);
			this.player.on("playing", () => this.$emit("playing"));
			this.player.on("pause", () => this.$emit("paused"));
			this.player.on("play", () => this.$emit("waiting"));
			this.player.on("stalled", () => this.$emit("buffering"));
			this.player.on("loadstart", () => this.$emit("buffering"));
			this.player.on("canplay", () => this.$emit("ready"));
			this.player.on("error", () => this.$emit("error"));
			this.player.on("progress", () => {
				this.$emit("buffer-progress", this.player.bufferedPercent());
				this.$emit("buffer-spans", this.player.buffered());
			});
			this.loadVideoSource();
		},
		onVideoEnd() {
			this.player.reset();
		},
	},
	watch: {
		redditPostId() {
			this.player.reset();
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
