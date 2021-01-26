<template>
	<v-card class="user-list">
		<v-subheader>
			Users
			<v-btn icon x-small @click="openEditName">
				<v-icon>fas fa-cog</v-icon>
			</v-btn>
		</v-subheader>
		<v-list-item v-if="showEditName">
			<v-text-field
				v-model="inputUsername"
				@change="onEditNameChange"
				placeholder="Set your name"
				:loading="setUsernameLoading"
				:error-messages="setUsernameFailureText"
				/>
		</v-list-item>
		<v-list-item
			v-for="(user, index) in users"
			:key="index"
			:class="`user ${user.isLoggedIn ? 'registered' : ''} ${`role-${$store.state.permsMeta.roles[user.role].name}`}`">
			<span class="name">{{ user.name }}</span>
			<v-tooltip top>
				<template v-slot:activator="{ on, attrs }">
					<span v-bind="attrs" v-on="on">
						<v-icon small class="role" :aria-label="`${user.isYou ? 'you' : user.name} is ${$store.state.permsMeta.roles[user.role].display}`">
							fas fa-{{ {"2":"thumbs-up", "3":"chevron-up", "4":"star", "-1":"star" }[user.role] }}
						</v-icon>
					</span>
				</template>
				<span>{{ $store.state.permsMeta.roles[user.role].display }}</span>
			</v-tooltip>
			<span v-if="user.isYou" class="is-you">You</span>
			<v-tooltip top>
				<template v-slot:activator="{ on, attrs }">
					<span v-bind="attrs" v-on="on">
						<v-icon small class="player-status" :aria-label="`${user.isYou ? 'your' : user.name} player is ${user.status}`">
							fas fa-{{ {"buffering":"spinner", "ready":"check", "error":"exclamation" }[user.status] }}
						</v-icon>
					</span>
				</template>
				<span>{{ user.status }}</span>
			</v-tooltip>

			<div style="margin-left:auto" v-if="!user.isYou">
				<v-menu right offset-y>
					<template v-slot:activator="{ on, attrs }">
						<v-btn depressed tile v-bind="attrs" v-on="on">
							<v-icon small>fas fa-cog</v-icon>
							<v-icon small style="margin-left:5px" aria-hidden>fas fa-caret-down</v-icon>
						</v-btn>
					</template>
					<v-list>
						<v-list-item @click="promoteUser(user.name, 4)">
							Promote to Administrator
						</v-list-item>
						<v-list-item @click="promoteUser(user.name, 3)">
							Promote to Moderator
						</v-list-item>
						<v-list-item @click="promoteUser(user.name, 2)">
							Promote to Trusted User
						</v-list-item>
						<v-list-item @click="promoteUser(user.name, 1)">
							Demote to Normal User
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</v-list-item>
		<v-list-item class="nobody-here" v-if="users.length === 1">
			There seems to be nobody else here. Invite some friends!
		</v-list-item>
	</v-card>
</template>

<script>
import { API } from "@/common-http.js";

/** Lists users that are connected to a room. */
export default {
	name: "UserList",
	props: {
		users: { type: Array },
	},
	data() {
		return {
			inputUsername: "",
			showEditName: false,
			setUsernameLoading: false,
			setUsernameFailureText: "",
		};
	},
	async created() {
		await this.$store.dispatch("updatePermissionsMetadata");
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
		promoteUser(username, role) {
			this.$socket.sendObj({
				action: "set-role",
				username,
				role,
			});
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
</style>
