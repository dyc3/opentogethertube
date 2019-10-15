<template>
	<v-container fill-height>
		<v-row justify="center">
			<v-col align="center">
				<h1>Page Not Found</h1>
				<v-btn elevation="12" x-large to="/">Home</v-btn>
				<v-spacer />
				<v-btn elevation="12" x-large to="/rooms">Browse Rooms</v-btn>
			</v-col>
		</v-row>
	</v-container>
</template>

<script>
export default {
	name: 'not-found',
	data() {
		return {};
	},
};
</script>

<style lang="scss" scoped>

</style>
