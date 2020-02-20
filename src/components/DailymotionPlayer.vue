<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div class="dailymotion" id="dailymotion-player"></div>
</template>

<script>
// import axios from "axios";
import { getSdk } from "../util/playerHelper.js";

const DAILYMOTION_SDK_URL = "https://api.dmcdn.net/all.js";
// const DAILYMOTION_OEMBED_API_URL = "http://www.dailymotion.com/services/oembed";

export default {
	name: "DailymotionPlayer",
	props: {
		videoId: { type: String, required: true },
	},
	data() {
		return {
			DM: null,
			player: null,
		};
	},
	created() {
		getSdk(DAILYMOTION_SDK_URL, "DM").then(DM => {
			console.log("DM: ", DM);
			this.DM = DM;
			this.updateIframe();
		});
	},
	methods: {
		updateIframe() {
			this.player = new this.DM.player(document.getElementById('dailymotion-player'), {
				video: this.videoId,
				width: "100%",
				height: "100%",
				params: {
					autoplay: false,
				},
				events: {
					apiready: () => this.$emit("ready"),
					video_end: () => this.$emit("end"),
					playing: () => this.$emit("playing"),
					pause: () => this.$emit("paused"),
					waiting: () => this.$emit("buffering"),
				},
			});
			// axios.get(`${DAILYMOTION_OEMBED_API_URL}?url=https://dailymotion.com/video/${this.videoId}`).then(res => {
			// 	this.iframe = res.data.html;
			// 	// setTimeout(() => {
			// 	// 	this.player.on("play", () => this.$emit("playing"));
			// 	// 	this.player.on("pause", () => this.$emit("paused"));
			// 	// 	this.player.on("loaded", () => this.$emit("ready"));
			// 	// 	this.player.on("bufferstart", () => {
			// 	// 		this.isBuffering = true;
			// 	// 		this.$emit("butterstart");
			// 	// 	});
			// 	// 	this.player.on("bufferend", () => {
			// 	// 		this.isBuffering = false;
			// 	// 		this.$emit("butterend");
			// 	// 	});
			// 	// }, 0);
			// });
		},
		play() {
			return this.player.play();
		},
		pause() {
			return this.player.pause();
		},
		getPosition() {
			return this.player.currentTime;
		},
		setPosition(position) {
			return this.player.seek(position);
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
.dailymotion {
	position: absolute;
	width: 100%;
	height: 100%;

	color: #696969;
	border: 1px solid #666;
	border-radius: 3px;
}
</style>
