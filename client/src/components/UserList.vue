<template>
	<Card class="user-list border-line-strong">
		<CardHeader class="flex flex-row items-center justify-between gap-2 py-3">
			<CardTitle class="label-mono text-primary">{{ $t("room.users.title") }}</CardTitle>
			<Button
				variant="ghost"
				size="icon-sm"
				@click="openEditName"
				aria-label="toggle edit name"
			>
				<Icon :icon="mdiWrench" class="size-4" />
			</Button>
		</CardHeader>
		<CardContent class="flex flex-col gap-1 pb-3">
			<div v-if="showEditName" class="px-1 py-2">
				<div class="relative flex items-center">
					<Input
						v-model="inputUsername"
						class="w-full pr-8 font-mono"
						:placeholder="$t('room.users.set')"
						:maxlength="USERNAME_LENGTH_MAX"
						:aria-invalid="!!setUsernameFailureText || undefined"
						@keydown.enter="onEditNameChange"
						@blur="onEditNameChange"
					/>
					<Spinner v-if="setUsernameLoading" class="absolute right-2 size-4" />
				</div>
				<div class="mt-1 flex justify-between gap-2">
					<span v-if="setUsernameFailureText" class="text-xs text-destructive">
						{{ setUsernameFailureText }}
					</span>
					<span class="ml-auto text-xs text-dim font-mono">
						{{ inputUsername.length }}/{{ USERNAME_LENGTH_MAX }}
					</span>
				</div>
			</div>

			<div
				v-for="(user, index) in users"
				:key="index"
				:class="getUserCssClasses(user)"
			>
				<span class="name">{{ user.name }}</span>
				<Badge v-if="debugMode" variant="secondary" class="user-chip font-mono">
					{{ user.id }}
				</Badge>
				<Badge
					v-if="user.id === store.state.users.you.id"
					variant="outline"
					class="user-chip border-primary text-primary"
				>
					{{ $t("room.users.you") }}
				</Badge>
				<Tooltip v-if="!!getRoleIcon(user.role)">
					<TooltipTrigger as-child>
						<span
							class="inline-flex"
							:aria-label="`${
								user.id === store.state.users.you.id ? 'you' : user.name
							} is roles.${user.role}`"
						>
							<Icon class="role size-4" :icon="getRoleIcon(user.role)" />
						</span>
					</TooltipTrigger>
					<TooltipContent>{{ $t(`roles.${user.role}`) }}</TooltipContent>
				</Tooltip>
				<Tooltip v-if="!!getPlayerStatusIcon(user.status)">
					<TooltipTrigger as-child>
						<span
							class="inline-flex"
							:aria-label="`${
								user.id === store.state.users.you.id ? 'your' : user.name
							} player is ${user.status}`"
						>
							<Icon class="player-status size-4" :icon="getPlayerStatusIcon(user.status)" />
						</span>
					</TooltipTrigger>
					<TooltipContent>{{ user.status }}</TooltipContent>
				</Tooltip>

				<div class="flex-1" />

				<div v-if="user.id !== store.state.users.you.id">
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<Button variant="ghost" size="sm" class="user-actions gap-1">
								<Icon :icon="mdiWrench" class="size-4" />
								<Icon :icon="mdiChevronDown" class="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<template v-for="role in [4, 3, 2, 1]" :key="user.role + role">
								<DropdownMenuItem
									v-if="canUserBePromotedTo(user, role)"
									@click="promoteUser(user.id, role)"
								>
									{{
										user.role > role
											? $t("room.users.demote")
											: $t("room.users.promote")
									}}
									to {{ $t(`roles.${role}`) }}
								</DropdownMenuItem>
							</template>
							<DropdownMenuItem
								v-if="canSelfKickUser(user)"
								class="text-destructive"
								@click="kickUser(user.id)"
							>
								{{ $t("room.users.kick") }}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div class="nobody-here" v-if="users.length === 1">
				{{ $t("room.users.empty") }}
			</div>
		</CardContent>
	</Card>
</template>

<script lang="ts" setup>
import {
	mdiWrench,
	mdiChevronDown,
	mdiStar,
	mdiChevronUp,
	mdiThumbUp,
	mdiProgressDownload,
	mdiCheckBold,
	mdiExclamation,
} from "@mdi/js";
import { ref, inject } from "vue";
import { API } from "@/common-http";
import { type ClientId, PlayerStatus, type RoomUserInfo } from "ott-common/models/types";
import { USERNAME_LENGTH_MAX } from "ott-common/constants";
import { Role } from "ott-common/models/types";
import { ROLE_NAMES } from "ott-common/permissions";
import { useStore } from "@/store";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import { canKickUser } from "ott-common/userutils";
import { useGrants } from "./composables/grants";

defineProps<{
	users: RoomUserInfo[];
}>();

const store = useStore();
const roomapi = useRoomApi(useConnection());
const granted = useGrants();
const debugMode = inject("debugMode", false);

const inputUsername = ref("");
const showEditName = ref(false);
const setUsernameLoading = ref(false);
const setUsernameFailureText = ref("");

function openEditName() {
	if (!inputUsername.value) {
		inputUsername.value = store.state.user
			? store.state.user.username
			: store.state.username ?? "";
	}
	showEditName.value = !showEditName.value;
}

async function onEditNameChange() {
	setUsernameLoading.value = true;
	try {
		await API.post("/user", { username: inputUsername.value });
		showEditName.value = false;
		setUsernameFailureText.value = "";
		roomapi.notify("usernameChanged");
	} catch (err) {
		setUsernameFailureText.value = err.response ? err.response.data.error.message : err.message;
	}
	setUsernameLoading.value = false;
}

/** Gets the appropriate permission name for the role and promotion/demotion. */
function roleToPermission(role: Role, demote = false) {
	const r = {
		[Role.Administrator]: "admin",
		[Role.Moderator]: "moderator",
		[Role.TrustedUser]: "trusted-user",
	}[role];
	return `manage-users.${demote ? "de" : "pro"}mote-${r}`;
}

function getUserCssClasses(user: RoomUserInfo) {
	const cls = ["user", `role-${ROLE_NAMES[user.role]}`];
	if (user.isLoggedIn) {
		cls.push("registered");
	}
	return cls.join(" ");
}

function canUserBePromotedTo(user: RoomUserInfo, role: Role): boolean {
	if (user.role === role) {
		return false;
	}
	if (user.role === Role.UnregisteredUser || role === Role.UnregisteredUser) {
		return false;
	}
	if (role > Role.RegisteredUser) {
		// check for promote
		return granted(roleToPermission(role));
	}
	if (user.role >= Role.RegisteredUser) {
		// check for demote
		return granted(roleToPermission(user.role, true));
	}

	return false;
}

function canSelfKickUser(user: RoomUserInfo): boolean {
	const you = store.state.users.users.get(store.state.users.you.id);
	if (!you) {
		return false;
	}
	return granted("manage-users.kick") && canKickUser(you.role, user.role);
}

function getRoleIcon(role: Role) {
	return {
		[Role.Owner]: mdiStar,
		[Role.Administrator]: mdiStar,
		[Role.Moderator]: mdiChevronUp,
		[Role.TrustedUser]: mdiThumbUp,
	}[role];
}

function getPlayerStatusIcon(status: PlayerStatus) {
	return {
		[PlayerStatus.buffering]: mdiProgressDownload,
		[PlayerStatus.ready]: mdiCheckBold,
		[PlayerStatus.error]: mdiExclamation,
	}[status];
}

function promoteUser(clientId: ClientId, role: Role) {
	roomapi.promoteUser(clientId, role);
}

function kickUser(clientId: ClientId) {
	roomapi.kickUser(clientId);
}
</script>

<style lang="scss" scoped>
.user {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 2px;
	padding: 4px 8px;
	border-radius: 3px;
	border-left: 2px solid transparent;
	transition: background 0.15s ease, border-color 0.15s ease;

	&:hover {
		background: var(--surface-2);
	}

	.name {
		color: var(--muted-foreground);
		font-style: italic;
	}

	.role,
	.player-status {
		margin: 0 3px;
		color: var(--muted-foreground);
	}

	.user-chip {
		margin: 0 3px;
	}

	&.registered {
		.name {
			color: var(--foreground);
			font-style: normal;
		}
	}

	&.role-owner {
		border-left-color: var(--primary);

		.role {
			color: var(--primary);
		}
	}
}

.nobody-here {
	font-style: italic;
	color: var(--muted-foreground);
	font-size: 0.9em;
	padding: 4px 8px;
}
</style>
