<template>
	<div class="home">
		<v-container class="hero" fluid fill-height grid-list-md text-xs-center>
			<v-row align="center" justify="center" no-gutters>
				<div class="hero-text" cols="12" sm="10" md="8" lg="6">
					<h1>{{ $t("landing.hero.title") }}</h1>
					<span>
						{{ $t("landing.hero.description") }}
					</span>
					<div class="hero-buttons">
						<v-btn elevation="12" size="x-large" @click="createTempRoom">{{
							$t("landing.hero.btns.create")
						}}</v-btn>
						<v-btn elevation="12" size="x-large" to="/rooms">{{
							$t("landing.hero.btns.browse")
						}}</v-btn>
						<v-btn
							elevation="12"
							size="x-large"
							href="https://github.com/dyc3/opentogethertube"
							>{{ $t("landing.hero.btns.source") }}</v-btn
						>
					</div>
				</div>
			</v-row>
		</v-container>
		<v-container class="content">
			<v-row>
				<v-col>
					<h1>{{ $t("landing.intro.title") }}</h1>
					<p>
						<strong>{{ $t("landing.intro.name") }}</strong>
						{{ $t("landing.intro.text1") }}
					</p>
					<p>
						{{ $t("landing.intro.text2") }}
					</p>
					<p>
						{{ $t("landing.intro.text3") }}
						<a
							href="https://github.com/dyc3/opentogethertube/labels/service%20support%20request"
							>{{ $t("landing.intro.link") }}</a
						>.
					</p>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<h1>{{ $t("landing.features.title") }}</h1>
					<v-row dense class="features">
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>{{
									$t("landing.features.syncronized-playback.title")
								}}</v-card-title>
								<v-card-text>
									{{ $t("landing.features.syncronized-playback.text") }}
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>{{
									$t("landing.features.permanent-rooms.title")
								}}</v-card-title>
								<v-card-text>
									{{ $t("landing.features.permanent-rooms.text") }}
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>{{
									$t("landing.features.dark-theme.title")
								}}</v-card-title>
								<v-card-text>
									{{ $t("landing.features.dark-theme.text") }}
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>{{
									$t("landing.features.room-permissions.title")
								}}</v-card-title>
								<v-card-text>
									{{ $t("landing.features.room-permissions.text") }}
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>{{
									$t("landing.features.voting-system.title")
								}}</v-card-title>
								<v-card-text>
									{{ $t("landing.features.voting-system.text") }}
								</v-card-text>
							</v-card>
						</v-col>
						<v-col cols="12" sm="6" md="4">
							<v-card hover :height="cardHeight">
								<v-card-title>{{
									$t("landing.features.playlist-copying.title")
								}}</v-card-title>
								<v-card-text>
									{{ $t("landing.features.playlist-copying.text") }}
								</v-card-text>
							</v-card>
						</v-col>
					</v-row>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<h1>{{ $t("landing.support.title") }}</h1>
					<v-row>
						<v-col>
							<p>
								<strong>{{ $t("landing.support.description1") }}</strong>
								{{ $t("landing.support.description2") }}
							</p>
						</v-col>
						<v-col>
							<h3>{{ $t("landing.support.how") }}</h3>
							<v-btn
								size="x-large"
								block
								color="red"
								href="https://github.com/sponsors/dyc3"
								target="_blank"
							>
								<v-icon class="side-pad">fa:fas fa-heart</v-icon>
								{{ $t("landing.support.sponsor") }}
							</v-btn>
							<v-btn
								size="x-large"
								block
								color="blue"
								class="mt-2"
								href="https://github.com/dyc3/opentogethertube"
								target="_blank"
							>
								<v-icon class="side-pad">fa:fas fa-code</v-icon>
								{{ $t("landing.support.contribute") }}
							</v-btn>
						</v-col>
					</v-row>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<em style="opacity: 0.5">{{ $t("footer.disclaimer") }}</em>
				</v-col>
			</v-row>
			<v-footer>
				<v-container pa-0>
					<v-row no-gutters align="center" justify="center">
						{{ new Date().getFullYear() }} -
						<a class="side-pad" href="https://carsonmcmanus.com/">Carson McManus</a> -
						{{ $t("footer.made-in") }} - {{ $t("footer.thanks-to") }}
						<a class="side-pad" href="https://softe.club">SEC</a> @ Stevens
					</v-row>
					<v-row no-gutters align="center" justify="center">
						<router-link class="side-pad" to="/privacypolicy">{{
							$t("footer.privacy-policy")
						}}</router-link
						><router-link class="side-pad" to="/attribution">{{
							$t("footer.attribution")
						}}</router-link>
					</v-row>
				</v-container>
			</v-footer>
		</v-container>
	</div>
</template>

<script>
import { defineComponent, computed } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { useStore } from "vuex";

export const HomeView = defineComponent({
	name: "home",
	setup() {
		const store = useStore();

		async function createTempRoom() {
			await createRoomHelper(store);
		}

		const cardHeight = computed(() => {
			return 180;
		});

		return {
			createTempRoom,
			cardHeight,
		};
	},
});

export default HomeView;
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.home {
	width: 100%;
}

.hero {
	background: linear-gradient(
		217deg,
		rgb(125, 74, 239),
		rgb(227, 141, 174) 30%,
		rgb(247, 208, 109)
	);
	color: white;
	font-size: 22px;
	height: 100vh;
	min-height: 350px;
	display: flex;

	h1 {
		font-size: 52px;
	}

	@media only screen and (max-width: $xs-max) {
		h1 {
			font-size: 48px;
		}
	}

	.hero-text {
		display: flex;
		flex-direction: column;
		max-width: 600px;

		.hero-buttons {
			display: flex;
			flex-direction: row;
			justify-content: space-between;

			.v-btn {
				background: transparent !important;
				// margin: 0 10px;
				@media only screen and (max-width: $md-max) {
					margin-top: 22px;
				}
			}

			@media screen and (max-width: $sm-max) {
				flex-direction: column;
			}
		}
	}
}
</style>
