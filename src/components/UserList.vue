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
			:class="`user ${user.isLoggedIn ? 'registered' : ''} ${getUserCssClass(user)}`">
			<span class="name">{{ user.name }}</span>
			<v-tooltip top>
				<template v-slot:activator="{ on, attrs }">
					<span v-bind="attrs" v-on="on">
						<v-icon small class="role" :aria-label="`${user.isYou ? 'you' : user.name} is ${user.role}`">
							fas fa-{{ {"2":"thumbs-up", "3":"chevron-up", "4":"star", "-1":"star" }[user.role] }}
						</v-icon>
					</span>
				</template>
				<span>{{ {"-1":"Owner", "0":"Unregistered", "1":"Registered", "2":"Trusted", "3":"Moderator", "4":"Administrator"}[user.role] }}</span>
			</v-tooltip>
			<span v-if="user.isYou" class="is-you">You</span>
			<v-icon small class="player-status" :aria-label="`${user.isYou ? 'your' : user.name} player is ${user.status}`">
				fas fa-{{ {"buffering":"spinner", "ready":"check", "error":"exclamation" }[user.status] }}
			</v-icon>
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
	methods: {
		getUserCssClass(user) {
			// TODO: derive css class name from `role.name` in permissions metadata
			return "role-" + {"-1":"owner", "0":"unregistered", "1":"registered", "2":"trusted", "3":"mod", "4":"admin"}[user.role];
		},
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
