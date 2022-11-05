<template>
	<v-menu offset-y v-if="$store.state.user">
		<template v-slot:activator="{ props }">
			<v-btn text v-bind="props" :key="$store.state.user.username">
				{{ $store.state.user.username }}
			</v-btn>
		</template>
		<v-list two-line max-width="400">
			<v-list-item
				href="/api/auth/discord"
				target="_blank"
				v-if="!$store.state.user.discordLinked"
			>
				<v-list-item-title>{{ $t("nav.link-discord") }}</v-list-item-title>
			</v-list-item>
			<v-list-item @click="$emit('logout')">
				<v-list-item-title>{{ $t("nav.logout") }}</v-list-item-title>
			</v-list-item>
		</v-list>
	</v-menu>
	<v-btn text @click="$emit('login')" v-else>
		{{ $t("nav.login") }}
	</v-btn>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
	name: "NavUser",
	emits: ["login", "logout"],
});
</script>
