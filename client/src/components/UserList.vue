<template>
	<v-card class="user-list">
		<v-card-title>
			{{ $t("room.users.title") }}
			<v-btn icon size="x-small" @click="openEditName">
				<v-icon>fas fa-cog</v-icon>
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
		<v-list-item v-for="(user, index) in users" :key="index" :class="getUserCssClasses(user)">
			<span class="name">{{ user.name }}</span>
			<span>
				<v-icon
					small
					class="role"
					:aria-label="`${user.id === $store.state.users.you.id ? 'you' : user.name} is ${
						ROLE_DISPLAY_NAMES[user.role]
					}`"
				>
					fas fa-{{
						{ "2": "thumbs-up", "3": "chevron-up", "4": "star", "-1": "star" }[
							user.role
						]
					}}
				</v-icon>
				<v-tooltip activator="parent" location="top">
					<span>{{ ROLE_DISPLAY_NAMES[user.role] }}</span>
				</v-tooltip>
			</span>
			<span v-if="user.id === $store.state.users.you.id" class="is-you">{{
				$t("room.users.you")
			}}</span>
			<span>
				<v-icon
					small
					class="player-status"
					:aria-label="`${
						user.id === $store.state.users.you.id ? 'your' : user.name
					} player is ${user.status}`"
				>
					fas fa-{{
						{
							[PlayerStatus.buffering]: "spinner",
							[PlayerStatus.ready]: "check",
							[PlayerStatus.error]: "exclamation",
						}[user.status]
					}}
				</v-icon>
				<v-tooltip activator="parent" location="top">
					<span>{{ user.status }}</span>
				</v-tooltip>
			</span>

			<div style="margin-left: auto" v-if="user.id !== $store.state.users.you.id">
				<v-menu right offset-y>
					<template v-slot:activator="{ props }">
						<v-btn depressed tile v-bind="props">
							<v-icon small>fas fa-cog</v-icon>
							<v-icon size="small" style="margin-left: 5px" aria-hidden>
								fas fa-caret-down
							</v-icon>
						</v-btn>
					</template>
					<v-list>
						<div class="user-promotion">
							<div v-for="role in 4" :key="user.role + role">
								<v-list-item
									@click="api.promoteUser(user.id, role)"
									v-if="canUserBePromotedTo(user, role)"
								>
									{{
										user.role > role
											? $t("room.users.demote")
											: $t("room.users.promote")
									}}
									to {{ ROLE_DISPLAY_NAMES[role] }}
								</v-list-item>
							</div>
						</div>
					</v-list>
				</v-menu>
			</div>
		</v-list-item>
		<v-list-item class="nobody-here" v-if="users.length === 1">
			{{ $t("room.users.empty") }}
		</v-list-item>
	</v-card>
</template>

<script>
import { API } from "@/common-http.js";
import { PlayerStatus } from "common/models/types";
import api from "@/util/api";
import { USERNAME_LENGTH_MAX } from "common/constants";
import { GrantChecker } from "@/util/grants";
import { Role } from "common/models/types";
import { ROLE_NAMES, ROLE_DISPLAY_NAMES } from "common/permissions";

/** Lists users that are connected to a room. */
export default {
	name: "UserList",
	props: {
		users: { type: Array },
	},
	data() {
		return {
			PlayerStatus,
			inputUsername: "",
			showEditName: false,
			setUsernameLoading: false,
			setUsernameFailureText: "",
			api,
			USERNAME_LENGTH_MAX,

			grants: new GrantChecker(),
			Role,
			ROLE_NAMES,
			ROLE_DISPLAY_NAMES,
		};
	},
	methods: {
		openEditName() {
			if (!this.inputUsername) {
				this.inputUsername = this.$store.state.user
					? this.$store.state.user.username
					: this.$store.state.username;
			}
			this.showEditName = !this.showEditName;
		},
		async onEditNameChange() {
			this.setUsernameLoading = true;
			try {
				await API.post("/user", { username: this.inputUsername });
				this.showEditName = false;
				this.setUsernameFailureText = "";
			} catch (err) {
				this.setUsernameFailureText = err.response
					? err.response.data.error.message
					: err.message;
			}
			this.setUsernameLoading = false;
		},
		/** Gets the appropriate permission name for the role and promotion/demotion. */
		roleToPermission(role, demote = false) {
			let r = {
				[Role.Administrator]: "admin",
				[Role.Moderator]: "moderator",
				[Role.TrustedUser]: "trusted-user",
			}[role];
			return `manage-users.${demote ? "de" : "pro"}mote-${r}`;
		},
		getUserCssClasses(user) {
			let cls = ["user", `role-${ROLE_NAMES[user.role]}`];
			if (user.isLoggedIn) {
				cls.push("registered");
			}
			return cls;
		},
		canUserBePromotedTo(user, role) {
			if (user.role === role) {
				return false;
			}
			if (user.role === Role.UnregisteredUser || role === Role.UnregisteredUser) {
				return false;
			}
			if (role > Role.RegisteredUser) {
				// check for promote
				return this.grants.granted(this.roleToPermission(role));
			}
			if (user.role >= Role.RegisteredUser) {
				// check for demote
				return this.grants.granted(this.roleToPermission(user.role, true));
			}

			return false;
		},
	},
};
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.user {
	.name {
		opacity: 0.5;
		font-style: italic;
	}

	.role,
	.player-status,
	.is-you {
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

.is-you {
	color: $brand-color;
	border: 1px $brand-color solid;
	border-radius: 10px;
	padding: 0 5px;
	font-size: 10px;
}

.nobody-here {
	font-style: italic;
	opacity: 0.5;
	font-size: 0.9em;
}

.user-promotion {
	display: flex;
	flex-direction: column-reverse;
}
</style>
