<template>
	<v-card class="user-list">
		<v-subheader>
			{{ $t("room.users.title") }}
			<v-btn icon x-small @click="openEditName">
				<v-icon>fas fa-cog</v-icon>
			</v-btn>
		</v-subheader>
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
		<div v-if="!$store.state.permsMeta.loaded">
			Waiting for permissions metadata...
		</div>
		<v-list-item
			v-for="(user, index) in users"
			:key="index"
			:class="`user ${user.isLoggedIn ? 'registered' : ''} ${$store.state.permsMeta.loaded ? `role-${$store.state.permsMeta.roles[user.role].name}` : ''}`">
			<span class="name">{{ user.name }}</span>
			<v-tooltip top v-if="$store.state.permsMeta.loaded">
				<template v-slot:activator="{ on, attrs }">
					<span v-bind="attrs" v-on="on">
						<v-icon small class="role" :aria-label="`${user.id === $store.state.users.you.id ? 'you' : user.name} is ${$store.state.permsMeta.roles[user.role].display}`">
							fas fa-{{ {"2":"thumbs-up", "3":"chevron-up", "4":"star", "-1":"star" }[user.role] }}
						</v-icon>
					</span>
				</template>
				<span>{{ $store.state.permsMeta.roles[user.role].display }}</span>
			</v-tooltip>
			<span v-if="user.id === $store.state.users.you.id" class="is-you">You</span>
			<v-tooltip top>
				<template v-slot:activator="{ on, attrs }">
					<span v-bind="attrs" v-on="on">
						<v-icon small class="player-status" :aria-label="`${user.id === $store.state.users.you.id ? 'your' : user.name} player is ${user.status}`">
							fas fa-{{ { [PlayerStatus.buffering]: "spinner", [PlayerStatus.ready]: "check", [PlayerStatus.error]: "exclamation" }[user.status] }}
						</v-icon>
					</span>
				</template>
				<span>{{ user.status }}</span>
			</v-tooltip>

			<div style="margin-left:auto" v-if="user.id !== $store.state.users.you.id">
				<v-menu right offset-y>
					<template v-slot:activator="{ on, attrs }">
						<v-btn depressed tile v-bind="attrs" v-on="on">
							<v-icon small>fas fa-cog</v-icon>
							<v-icon small style="margin-left:5px" aria-hidden>fas fa-caret-down</v-icon>
						</v-btn>
					</template>
					<v-list>
						<div class="user-promotion" v-if="$store.state.permsMeta.loaded" :key="$store.state.permsMeta.loaded">
							<div v-for="role in 4" :key="user.role + role">
								<v-list-item @click="api.promoteUser(user.id, role)" v-if="user.role !== role && (role <= 1 || granted(roleToPermission(role))) && (user.role > 0 && user.role <= 1 || granted(roleToPermission(user.role, demote=true)))">
									{{ user.role > role ? "Demote" : "Promote" }} to {{ $store.state.permsMeta.roles[role].display }}
								</v-list-item>
							</div>
						</div>
						<v-row v-else justify="center">
							<v-progress-circular indeterminate/>
						</v-row>
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
import PermissionsMixin from "@/mixins/permissions";
import { PlayerStatus } from "common/models/types";
import api from "@/util/api";
import { USERNAME_LENGTH_MAX } from "common/constants";

/** Lists users that are connected to a room. */
export default {
	name: "UserList",
	props: {
		users: { type: Array },
	},
	mixins: [PermissionsMixin],
	data() {
		return {
			PlayerStatus,
			inputUsername: "",
			showEditName: false,
			setUsernameLoading: false,
			setUsernameFailureText: "",
			api,
			USERNAME_LENGTH_MAX,
		};
	},
	async created() {
		await this.$store.dispatch("updatePermissionsMetadata");
		await this.waitForMetadata();
	},
	methods: {
		openEditName() {
			if (!this.inputUsername) {
				this.inputUsername = this.$store.state.user ? this.$store.state.user.username : this.$store.state.username;
			}
			this.showEditName = !this.showEditName;
		},
		async onEditNameChange() {
			this.setUsernameLoading = true;
			try {
				await API.post("/user", { username: this.inputUsername });
				this.showEditName = false;
				this.setUsernameFailureText = "";
			}
			catch (err) {
				this.setUsernameFailureText = err.response ? err.response.data.error.message : err.message;
			}
			this.setUsernameLoading = false;
		},
		/** Gets the appropriate permission name for the role and promotion/demotion. */
		roleToPermission(role, demote=false) {
			let r = {
				4: "admin",
				3: "moderator",
				2: "trusted-user",
			}[role];
			return `manage-users.${demote ? "de" : "pro" }mote-${r}`;
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

	.role, .player-status, .is-you {
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
