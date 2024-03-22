<template>
	<v-container>
		<v-row class="center-shit">
			<div>
				<h1>{{ $t("not-found.title") }}</h1>
				<v-btn block class="not-found-btn" elevation="12" size="x-large" to="/">
					{{ $t("not-found.home") }}
				</v-btn>
				<v-btn block class="not-found-btn" elevation="12" size="x-large" to="/rooms">
					{{ $t("not-found.browse") }}
				</v-btn>
			</div>
		</v-row>
	</v-container>
</template>

<style lang="scss">
.not-found-btn {
	margin: 8px;
}
</style>
