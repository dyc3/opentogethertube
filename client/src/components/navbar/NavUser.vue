<template>
	<fragment>
		<v-btn text @click="$emit('login')" v-if="!$store.state.user">
			{{ $t("nav.login") }}
		</v-btn>
		<v-menu offset-y v-if="$store.state.user">
			<template v-slot:activator="{ on }">
				<v-btn text v-on="on" :key="$store.state.user.username">
					{{ $store.state.user.username }}
				</v-btn>
			</template>
			<v-list two-line max-width="400">
				<v-list-item
					href="/api/auth/discord"
					target="_blank"
					v-if="!$store.state.user.discordLinked"
				>
					<v-list-item-content>
						<v-list-item-title>{{ $t("nav.link-discord") }}</v-list-item-title>
					</v-list-item-content>
				</v-list-item>
				<v-list-item @click="$emit('logout')">
					<v-list-item-content>
						<v-list-item-title>{{ $t("nav.logout") }}</v-list-item-title>
					</v-list-item-content>
				</v-list-item>
			</v-list>
		</v-menu>
	</fragment>
</template>
