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
	updated() {
		this.updateIframe();
	},
	methods: {
		updateIframe() {
			axios.get(`${VIMEO_OEMBED_API_URL}?url=https://vimeo.com/${this.videoId}&responsive=true&portrait=false&controls=false`).then(res => {
				this.iframe = res.data.html;
			});
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
			return this.player.setCurrentTime(position);
		},
		setVolume(value) {
			return this.player.setVolume(value / 100);
		},
	},
};
</script>

<style lang="scss" scoped>
.vimeo {
	width: 100%;
	height: 100%;
}
</style>
