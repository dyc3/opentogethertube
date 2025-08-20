<template>
	<v-card class="user-list">
		<v-card-title>
			{{ $t("room.users.title") }}
			<v-btn icon size="x-small" @click="openEditName" aria-label="toggle edit name">
				<v-icon>mdi-wrench</v-icon>
			</v-btn>
		</v-card-title>
		<v-list-item v-if="showEditName">
			<v-text-field
				v-model="inputUsername"
				@change="onEditNameChange"
				:placeholder="$t('room.users.set')"
				:loading="setUsernameLoading"
				:error-messages="setUsernameFailureText"
				:counter="USERNAME_LENGTH_MAX"
			/>
		</v-list-item>
		<v-list-item v-for="(user, index) in users" :key="index">
			<div :class="getUserCssClasses(user)">
				<span class="name">{{ user.name }}</span>
				<v-chip class="user-chip" v-if="debugMode" size="x-small">
					{{ user.id }}
				</v-chip>
				<v-chip
					class="user-chip"
					size="x-small"
					color="primary"
					variant="outlined"
					v-if="user.id === store.state.users.you.id"
				>
					{{ $t("room.users.you") }}
				</v-chip>
				<span>
					<v-icon
						size="x-small"
						class="role"
						:aria-label="`${
							user.id === store.state.users.you.id ? 'you' : user.name
						} is roles.${user.role}`"
						v-if="!!getRoleIcon(user.role)"
						:icon="getRoleIcon(user.role)"
					/>
					<v-tooltip activator="parent" location="top">
						<span>{{ $t(`roles.${user.role}`) }}</span>
					</v-tooltip>
				</span>
				<span>
					<v-icon
						size="x-small"
						class="player-status"
						:aria-label="`${
							user.id === store.state.users.you.id ? 'your' : user.name
						} player is ${user.status}`"
						v-if="!!getPlayerStatusIcon(user.status)"
						:icon="getPlayerStatusIcon(user.status)"
					/>
					<v-tooltip activator="parent" location="top">
						<span>{{ user.status }}</span>
					</v-tooltip>
				</span>

				<v-spacer />

				<div v-if="user.id !== store.state.users.you.id">
					<v-btn class="user-actions" variant="flat" depressed tile>
						<v-icon size="small">mdi-wrench</v-icon>
						<v-icon size="small" style="margin-left: 5px">mdi-chevron-down</v-icon>
						<v-menu right offset-y activator="parent">
							<v-list>
								<div class="user-promotion">
									<div v-for="role in 4" :key="user.role + role">
										<v-list-item
											@click="promoteUser(user.id, role)"
											v-if="canUserBePromotedTo(user, role)"
										>
											{{
												user.role > role
													? $t("room.users.demote")
													: $t("room.users.promote")
											}}
											to {{ $t(`roles.${role}`) }}
										</v-list-item>
									</div>
								</div>
								<v-list-item
									@click="kickUser(user.id)"
									v-if="canSelfKickUser(user)"
								>
									<v-list-item-title>
										{{ $t("room.users.kick") }}
									</v-list-item-title>
								</v-list-item>
							</v-list>
						</v-menu>
					</v-btn>
				</div>
			</div>
		</v-list-item>
		<v-list-item class="nobody-here" v-if="users.length === 1">
			{{ $t("room.users.empty") }}
		</v-list-item>
	</v-card>
</template>

<script lang="ts" setup>
import { USERNAME_LENGTH_MAX } from "ott-common/constants";
import { ClientId, PlayerStatus, Role, RoomUserInfo } from "ott-common/models/types";
import { ROLE_NAMES } from "ott-common/permissions";
import { canKickUser } from "ott-common/userutils";
import { inject, ref } from "vue";
import { API } from "@/common-http";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";
import { useRoomApi } from "@/util/roomapi";
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
			: (store.state.username ?? "");
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
		[Role.Owner]: "mdi-star",
		[Role.Administrator]: "mdi-star",
		[Role.Moderator]: "mdi-chevron-up",
		[Role.TrustedUser]: "mdi-thumb-up",
	}[role];
}

function getPlayerStatusIcon(status: PlayerStatus) {
	return {
		[PlayerStatus.buffering]: "mdi-progress-download",
		[PlayerStatus.ready]: "mdi-check-bold",
		[PlayerStatus.error]: "mdi-exclamation",
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
@import "../variables.scss";

.user {
	display: flex;
	flex-direction: row;
	align-items: center;

	.name {
		opacity: 0.6;
		font-style: italic;
	}

	.role,
	.player-status,
	.user-chip {
		margin: 0 3px;
	}

	&.registered {
		.name {
			opacity: 1;
			font-style: normal;
		}
	}

	&.role-owner {
		.role {
			color: $brand-color;
		}
	}
}

.nobody-here {
	font-style: italic;
	opacity: 0.6;
	font-size: 0.9em;
}

.user-promotion {
	display: flex;
	flex-direction: column-reverse;
}
</style>
