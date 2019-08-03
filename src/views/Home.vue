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
					</v-flex>
				</v-layout>
			</v-layout>
		</v-container>
		<v-container>
			<v-layout row align-center>
				<v-flex>
					<h1>Simple and Easy.</h1>
				</v-flex>
			</v-layout>
		</v-container>
	</div>
</template>

<script>
export default {
	name: 'home'
}
</script>

<style lang="scss" scoped>
.home {
	width: 100%;
	height: 100%;
}

.hero {
	background: linear-gradient(217deg, rgb(206, 74, 239), rgb(247, 208, 109));
	color: white;
	font-size: 22px;

	h1 {
		font-size: 52px;
	}
}
</style>