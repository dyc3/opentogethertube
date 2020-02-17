<template>
	<div class="home">
		<v-container class="hero" fluid fill-height grid-list-md text-xs-center>
			<v-row align="center" justify="center">
				<div>
					<h1>Enjoy Together.</h1>
					<span>
						Real-time syncronized playback. Optional voting system.<br>
						Dark theme. No sign up required. All Open Source.
					</span>
					<v-layout :row="$vuetify.breakpoint.smAndUp"
							:column="$vuetify.breakpoint.xs"
							:justify-space-between="$vuetify.breakpoint.smAndUp"
							:justify-space-around="$vuetify.breakpoint.xs">
						<v-btn elevation="12" x-large @click="createRoom">Create Room</v-btn>
						<v-btn elevation="12" x-large to="/rooms">Browse Rooms</v-btn>
						<v-btn elevation="12" x-large href="https://github.com/dyc3/opentogethertube">View Source</v-btn>
					</v-layout>
				</div>
			</v-row>
		</v-container>
		<v-container class="content">
			<v-row>
				<v-col>
					<h1>Simple and Easy.</h1>
					<p>
						The original TogetherTube was loved for it's simple interface,
						and how easy it was to start watching videos right away.
						OpenTogetherTube aims to be just as easy, and then improve on
						top of that to make it even better.
					</p>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<h1>Core Features</h1>
					<v-row dense class="features">
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>Syncronized Playback</v-card-title>
								<v-card-text>
									You hit play, and the video plays for everybody
									in the room. Simple as that.
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>Permanent Rooms</v-card-title>
								<v-card-text>
									You and the squad come here often? Avoid the hastle
									of sending out a new link every time. Permanent
									rooms get a custom url that doesn't change
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>Dark Theme</v-card-title>
								<v-card-text>
									Watching Vine compilations late at night?
									OpenTogetherTube has a dark theme by default so
									your eyes won't suffer.
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>Room Permissions</v-card-title>
								<v-card-text>
									Tired of random goofballs joining your room and
									adding lots of loud videos to your chill lofi hip-hop
									listening session? Just block them from adding videos.
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>Voting System</v-card-title>
								<v-card-text>
									Can't decide what to watch next? Switch the queue
									to the vote system and let democracy do what it
									does best.
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>Playlist Copying</v-card-title>
								<v-card-text>
									Add entire playlists or channels to the video queue
									all at once so you don't have to sit there adding
									each video to the queue one by one. It's the best
									way to binge watch that new channel with your friends.
								</v-card-text>
							</v-card>
						</v-col>
					</v-row>
				</v-col>
			</v-row>
			<v-footer>
				<v-container pa-0>
					<v-row no-gutters align="center" justify="center">
						{{ new Date().getFullYear() }} -&nbsp;<a href="https://carsonmcmanus.com/">Carson McManus</a>&nbsp;- Made in America - Special Thanks to&nbsp;<a href="https://softe.club">SEC</a>&nbsp;@ Stevens
					</v-row>
				</v-container>
			</v-footer>
		</v-container>
		<v-overlay :value="isLoading">
			<v-container fill-height>
				<v-row align="center" justify="center">
					<v-col cols="12" sm="4">
						<v-progress-circular indeterminate />
						<v-btn elevation="12" x-large @click="cancelRoom" style="margin-top: 24px">Cancel</v-btn>
					</v-col>
				</v-row>
			</v-container>
		</v-overlay>
	</div>
</template>

<script>
import { API } from "@/common-http.js";

export default {
	name: 'home',
	data() {
		return {
			isLoading: false,
		};
	},
	computed: {
		cardHeight() {
			return this.$vuetify.breakpoint.mdAndUp ? 180 : 180;
		},
	},
	methods: {
		createRoom() {
			this.isLoading = true;
			this.cancelledCreation = false;
			API.post("/room/generate").then(res => {
				if (!this.cancelledCreation) {
					this.isLoading = false;
					this.cancelledCreation = false;
					this.$router.push(`/room/${res.data.room}`);
				}
			});
		},
		cancelRoom() {
			this.cancelledCreation = true;
			this.isLoading = false;
		},
	},
};
</script>

<style lang="scss" scoped>
.home {
	width: 100%;
}

@media only screen and (max-width: 1264px) {
	.hero {
		.v-btn {
			margin-top: 22px;
		}
	}
}

.hero {
	background: linear-gradient(217deg, rgb(125, 74, 239), rgb(227,141,174) 30%, rgb(247, 208, 109));
	color: white;
	font-size: 22px;
	height: 100vh;
	min-height: 350px;

	h1 {
		font-size: 52px;
	}

	@media only screen and (max-width: 600px) {
		h1 {
			font-size: 48px;
		}
	}

	.v-btn {
		background: transparent !important;
	}
}
</style>
