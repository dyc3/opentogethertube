<template>
	<div class="spotify">
		"Spotify"
	</div>
</template>

<script>
export default {
	name: "SpotifyPlayer",
	props: {
		videoId: { type: String, required: true },
	},
	data() {
		return {

		};
	},
	methods: {
		play() {
			this.$refs.spotifyplayer.player.playVideo();
		},
		pause() {
			this.$refs.spotifyplayer.player.pauseVideo();
		},
		async getPosition() {
			return await this.$refs.spotifyplayer.player.getCurrentTime();
		},
		setPosition(position) {
			return this.$refs.spotifyplayer.player.seekTo(position);
		},
		setVolume(volume) {
			this.$refs.spotifyplayer.player.setVolume(volume);
		},

		onReady() {
			this.$refs.spotifyplayer.player.loadVideoById(this.$store.state.room.currentSource.id);
			this.$emit('apiready');
		},
	},
};
</script>

<style lang="scss" scoped>
.spotify-player {
	position: relative;
	padding-bottom: 56.25%;
	height: 0;
	overflow: hidden;
	max-width: 100%;

	iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
}
</style>
