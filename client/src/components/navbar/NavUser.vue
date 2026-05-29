<template>
	<DropdownMenu v-if="store.state.user">
		<DropdownMenuTrigger as-child>
			<Button variant="ghost" size="sm" :key="store.state.user.username" data-cy="user-logged-in">
				<Icon :icon="mdiAccountCircle" class="size-4 text-signal" />
				{{ store.state.user.username }}
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" class="w-52">
			<DropdownMenuItem as-child>
				<router-link to="/account">{{ $t("nav.account") }}</router-link>
			</DropdownMenuItem>
			<DropdownMenuItem v-if="!store.state.user.discordLinked" @click="goLoginDiscord">
				{{ $t("nav.link-discord") }}
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem class="text-destructive" @click="$emit('logout')">
				{{ $t("nav.logout") }}
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
	<Button v-else variant="outline" size="sm" data-cy="user-logged-out" @click="$emit('login')">
		{{ $t("nav.login") }}
	</Button>
</template>

<script lang="ts" setup>
import { mdiAccountCircle } from "@mdi/js";
import { goLoginDiscord } from "@/util/discord";
import { useStore } from "@/store";

defineEmits(["login", "logout"]);
const store = useStore();
</script>
