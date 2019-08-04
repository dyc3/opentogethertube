<template>
	<div class="home">
		<v-container class="hero" fluid bg fill-height grid-list-md text-xs-center>
			<v-layout row align-center>
				<v-layout column align-center>
					<v-flex>
						<h1>Enjoy Together.</h1>
						<span>
							Real-time syncronized playback. Optional voting system.<br>
							Dark theme. No sign up required. All Open Source.
						</span>
						<v-layout row justify-space-between style="margin-top: 16px">
							<v-btn elevation="12" @click="createRoom">Create Room</v-btn>
							<v-btn elevation="12" to="/rooms">Browse Rooms</v-btn>
							<v-btn elevation="12" href="https://github.com/dyc3/opentogethertube">View Source</v-btn>
						</v-layout>
					</v-flex>
				</v-layout>
			</v-layout>
		</v-container>
		<v-container>
			<v-layout row align-center>
				<v-flex>
					<h1>Simple and Easy.</h1>
					<p>
						The original TogetherTube was loved for it's simple interface,
						and how easy it was to start watching videos right away.
						OpenTogetherTube aims to be just as easy, and then improve on
						top of that to make it even better.
					</p>
				</v-flex>
			</v-layout>
		</v-container>
		<v-overlay :value="isLoading">
			<v-progress-circular indeterminate></v-progress-circular>
		</v-overlay>
	</div>
</template>

<script>
import { API } from "@/common-http.js";

export default {
	name: 'home',
	data() {
		return {
			isLoading: false
		}
	},
	methods: {
		createRoom() {
			this.isLoading = true;
			API.post("/room/generate").then(res => {
				this.isLoading = false;
				this.$router.push(`/room/${res.data.room}`);
			});
		}
	}
}
</script>

<style lang="scss" scoped>
.home {
	width: 100%;
}

.hero {
	background: linear-gradient(217deg, rgb(206, 74, 239), rgb(247, 208, 109));
	color: white;
	font-size: 22px;
	height: 100vh;

	h1 {
		font-size: 52px;
	}

	.v-btn {
		background: transparent !important;
	}
}
</style>