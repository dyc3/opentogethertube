<template>
	<div class="dailymotion">
		<div id="dailymotion-player"></div>
	</div>
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
		getSdk(DAILYMOTION_SDK_URL, "DM", "dmAsyncInit").then(DM => {
			this.DM = DM;
			this.DM.init({
				status: false,
				cookie: false,
			});
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
					api: 1,
					autoplay: false,
					controls: false,
					"ui-logo": false,
					"ui-start-screen-info": false,
				},
				events: {
					apiready: () => this.$emit("ready"),
					video_end: () => this.$emit("end"),
					playing: () => this.$emit("playing"),
					pause: () => this.$emit("paused"),
					waiting: () => this.$emit("buffering"),
				},
			});
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
	color: #696969;
	border: 1px solid #666;
	border-radius: 3px;
}
</style>
