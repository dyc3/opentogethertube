<template>
	<div>
		<youtube v-if="service == 'youtube'" :video-id="youtubeVideoId" ref="youtube"></youtube>
	</div>
</template>

<script>
import url from "url";

export default {
	name: "syncedvideo",
	props: {
		src: String
	},
	data() {
		return {
			service: '',
			youtubeVideoId: ''
		}
	},
	methods: {
		updateSource() {
			if (!this.src) {
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
		}
	},
	watch: {
		src(newSrc, oldSrc) {
			this.updateSource();
		}
	},
	mounted() {
		this.updateSource();
	}
}
</script>

<style lang="scss" scoped>

</style>
