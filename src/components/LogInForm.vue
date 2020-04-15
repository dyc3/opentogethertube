<template>
	<v-sheet>
		<v-tabs v-model="mode">
			<v-tab key="login">Log In</v-tab>
			<v-tab key="register">Register</v-tab>
		</v-tabs>
		<v-tabs-items v-model="mode">
			<v-tab-item>
				<v-card>
					<v-card-title>
						Log in
					</v-card-title>
					<v-card-text>
						<v-container>
							<v-row>
								<v-text-field :loading="isLoading" label="Email" required v-model="email" />
								<v-text-field :loading="isLoading" label="Password" required v-model="password" />
							</v-row>
							<v-row v-if="logInFailureMessage">
								{{ logInFailureMessage }}
							</v-row>
						</v-container>
					</v-card-text>
					<v-card-actions>
						<v-spacer />
						<v-btn color="primary" :loading="isLoading" @click="login">Log in</v-btn>
					</v-card-actions>
				</v-card>
			</v-tab-item>
			<v-tab-item>
				<v-card>
					<v-card-title>
						Register
					</v-card-title>
					<v-card-text>
						<v-container>
							<v-row>
								<v-text-field :loading="isLoading" label="Email" required v-model="email" />
								<v-text-field :loading="isLoading" label="Username" required v-model="username" />
								<v-text-field :loading="isLoading" label="Password" required v-model="password" />
							</v-row>
							<v-row v-if="registerFailureMessage">
								{{ registerFailureMessage }}
							</v-row>
						</v-container>
					</v-card-text>
					<v-card-actions>
						<v-spacer />
						<v-btn color="primary" :loading="isLoading" @click="register">Register</v-btn>
					</v-card-actions>
				</v-card>
			</v-tab-item>
		</v-tabs-items>
	</v-sheet>
</template>

<script>
import { API } from "@/common-http.js";

export default {
	name: "LogIn",
	data() {
		return {
			email: "",
			username: "",
			password: "",

			mode: "",
			isLoading: false,
			logInFailureMessage: "",
			registerFailureMessage: "",
		};
	},
	created() {
		if (this.$store.state.username) {
			this.username = this.$store.state.username;
		}
	},
	methods: {
		login() {
			this.isLoading = true;
			this.logInFailureMessage = "";
			API.post("/user/login", { email: this.email, password: this.password }).then(resp => {
				this.isLoading = false;
				if (resp.data.success) {
					console.log("Log in success");
					this.$store.commit("LOGIN", resp.data.user);
					this.$emit("shouldClose");
					this.email = "";
					this.password = "";
				}
				else {
					console.log("Log in failed");
				}
			}).catch(err => {
				this.isLoading = false;
				if (err.response && !err.response.data.success) {
					if (err.response.data.error) {
						this.logInFailureMessage = err.response.data.error.message;
					}
					else {
						this.logInFailureMessage = "Failed to log in, but the server didn't say why.";
					}
				}
				else {
					console.log("could not log in", err, err.response);
				}
			});
		},
		register() {
			this.isLoading = true;
			this.registerFailureMessage = "";
			API.post("/user/register", { email: this.email, username: this.username, password: this.password }).then(resp => {
				this.isLoading = false;
				if (resp.data.success) {
					console.log("Registeration success");
					this.$store.commit("LOGIN", resp.data.user);
					this.$emit("shouldClose");
					this.email = "";
					this.username = "";
					this.password = "";
				}
				else {
					console.log("Registeration failed");
				}
			}).catch(err => {
				this.isLoading = false;
				if (err.response && !err.response.data.success) {
					if (err.response.data.error) {
						this.registerFailureMessage = err.response.data.error.message;
					}
					else {
						this.registerFailureMessage = "Failed to register, but the server didn't say why.";
					}
				}
				else {
					console.log("could not register", err);
				}
			});
		},
	},
};
</script>

<style lang="scss" scoped>

</style>
