<template>
	<div class="googledrive">
		<video controls id="gdriveplayer" class="video-js vjs-default-skin" :key="videoId">
			<source :src="videoSource" :type="$store.state.room.currentSource.mime" />
		</video>
	</div>
</template>

<script>
import videojs from "video.js";

export default {
	name: "GoogleDrivePlayer",
	props: {
		videoId: { type: String, required: true },
	},
	data() {
		return {
			player: null,
		};
	},
	computed: {
		videoSource() {
			// Yes, we send the google drive api key to the client. This is because we need to get the download link, but we can only do that
			// by authenticating with google, either by api key or by having people sign in with google. This is easier, and not really a problem
			// because we have 1,000,000,000 google drive api quota and the api methods we use don't cost that much.
			return `https://www.googleapis.com/drive/v3/files/${this.videoId}?key=${process.env.GOOGLE_DRIVE_API_KEY}&alt=media&aknowledgeAbuse=true`;
		},
	},
	mounted() {
		this.player = videojs(document.getElementById("gdriveplayer"), {});
	},
	methods: {
		play() {
			return this.player.play();
		},
		pause() {
			return this.player.pause();
		},
	},
};
</script>

<style lang="scss" scoped>
@import url("https://vjs.zencdn.net/5.4.6/video-js.min.css");
</style>
