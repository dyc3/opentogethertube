<template>
	<v-content class="home">
		<v-container class="hero" fluid>
			<v-layout justify-center align-content-center>
				<v-spacer></v-spacer>
				<v-flex grow align-self-center>
					<h1>Enjoy Together.</h1>
				</v-flex>
				<v-flex grow align-self-center>
					Real-time syncronized playback. Optional voting system.
				</v-flex>
				<v-flex grow md4>
					No sign up required. All Open Source.
				</v-flex>
			</v-layout>
		</v-container>
	</v-content>
</template>

<script>
export default {
	name: 'home'
}
</script>

<style lang="scss" scoped>
.home {
	background-image: linear-gradient(to top, #88d3ce 0%, #6e45e2 100%);
	height: 100%;
}

.hero {
	color: white;
}
</style>