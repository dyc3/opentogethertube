<template>
	<div class="youtube-player">
		<youtube fit-parent resize :video-id="videoId" ref="youtubeplayer" :player-vars="{ controls: 0, disablekb: 1 }" @playing="$emit('playing')" @paused="$emit('paused')" @ready="$emit('ready')"/>
	</div>
</template>

<script>
export default {
	name: "YoutubePlayer",
	props: {
		videoId: { type: String, required: true },
	},
	data() {
		return {

		};
	},
	methods: {
		play() {
			this.$refs.youtubeplayer.player.playVideo();
		},
		pause() {
			this.$refs.youtubeplayer.player.pauseVideo();
		},
		async getPosition() {
			return await this.$refs.youtubeplayer.player.getCurrentTime();
		},
		setPosition(position) {
			return this.$refs.youtubeplayer.player.seekTo(position);
		},
		setVolume() {
			this.$refs.youtubeplayer.player.setVolume(this.volume);
		},
	},
};
</script>

<style lang="scss" scoped>
.youtube-player {
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
