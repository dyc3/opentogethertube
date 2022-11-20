<template>
	<v-container fill-height>
		<v-row justify="center">
			<v-col align="center">
				<h1>{{ $t("not-found.title") }}</h1>
				<v-btn elevation="12" size="x-large" to="/">{{ $t("not-found.home") }}</v-btn>
				<v-spacer />
				<v-btn elevation="12" size="x-large" to="/rooms">{{
					$t("not-found.browse")
				}}</v-btn>
			</v-col>
		</v-row>
	</v-container>
</template>

<script>
export default {
	name: "not-found",
	data() {
		return {};
	},
};
</script>

<style lang="scss" scoped></style>
