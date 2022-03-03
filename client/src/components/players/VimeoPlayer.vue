<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div class="vimeo" id="vimeo-player" v-html="iframe"></div>
</template>

<script>
import axios from "axios";
import vimeo from "@vimeo/player";

const VIMEO_OEMBED_API_URL = "https://vimeo.com/api/oembed.json";

export default {
	name: "VimeoPlayer",
	props: {
		videoId: { type: String, required: true },
	},
	data() {
		return {
			iframe: null,

			isBuffering: false,
		};
	},
	computed: {
		player() {
			return new vimeo("vimeo-player");
		},
	},
	created() {
		this.updateIframe();
	},
	methods: {
		async updateIframe() {
			let resp = await axios.get(
				`${VIMEO_OEMBED_API_URL}?url=https://vimeo.com/${this.videoId}&responsive=true&portrait=false&controls=false&playsinline=1`
			);
			this.iframe = resp.data.html;
			setTimeout(() => {
				this.player.on("play", () => this.$emit("playing"));
				this.player.on("pause", () => this.$emit("paused"));
				this.player.on("loaded", () => this.$emit("ready"));
				this.player.on("bufferstart", () => {
					this.isBuffering = true;
					this.$emit("buffering");
				});
				this.player.on("bufferend", () => {
					this.isBuffering = false;
					this.$emit("ready");
				});
				this.player.on("error", () => this.$emit("error"));
				this.$emit("apiready");
			}, 0);
		},
		play() {
			return this.player.play();
		},
		pause() {
			return this.player.pause();
		},
		getPosition() {
			return this.player.getCurrentTime();
		},
		setPosition(position) {
			return this.player.setCurrentTime(
				position + (this.$store.state.room.isPlaying && this.isBuffering ? 1 : 0)
			);
		},
		setVolume(value) {
			return this.player.setVolume(value / 100);
		},
	},
	watch: {
		videoId() {
			this.updateIframe();
		},
	},
};
</script>

<style lang="scss" scoped>
.vimeo {
	color: #696969;
}
</style>
