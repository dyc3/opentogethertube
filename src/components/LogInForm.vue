<template>
	<v-sheet>
		<v-tabs v-model="mode">
			<v-tab key="login">Log In</v-tab>
			<v-tab key="register">Register</v-tab>
		</v-tabs>
		<v-tabs-items v-model="mode">
			<v-tab-item>
				<v-card>
					<v-form ref="loginForm" @submit="login" v-model="loginValid" :lazy-validation="false">
						<v-card-title>
							Log in
						</v-card-title>
						<v-card-text>
							<v-container>
								<v-row>
									<v-text-field :loading="isLoading" label="Email" required v-model="email" :error-messages="logInFailureMessage" :rules="emailRules" />
									<v-text-field :loading="isLoading" label="Password" type="password" required v-model="password" :error-messages="logInFailureMessage" />
								</v-row>
								<v-row v-if="logInFailureMessage">
									{{ logInFailureMessage }}
								</v-row>
							</v-container>
							<v-divider />
							<v-container>
								<v-row>
									<v-btn x-large block href="/api/user/auth/discord" color="#7289DA">Log in with Discord</v-btn>
									<!-- TODO: <v-btn x-large block>Log in with Google</v-btn>
									<v-btn x-large block>Log in with Apple</v-btn> -->
								</v-row>
							</v-container>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn color="primary" :loading="isLoading" @click="login" :disabled="!loginValid">Log in</v-btn>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-tab-item>
			<v-tab-item>
				<v-card>
					<v-form ref="registerForm" @submit="register" v-model="registerValid" :lazy-validation="false">
						<v-card-title>
							Register
						</v-card-title>
						<v-card-text>
							<v-container>
								<v-row>
									<v-text-field :loading="isLoading" label="Email" required v-model="email" :error-messages="registerFieldErrors.email" :rules="emailRules" />
									<v-text-field :loading="isLoading" label="Username" required v-model="username" :error-messages="registerFieldErrors.username" :rules="usernameRules" />
									<v-text-field :loading="isLoading" label="Password" type="password" required v-model="password" :error-messages="registerFieldErrors.password" :rules="passwordRules" counter />
									<v-text-field :loading="isLoading" label="Retype Password" type="password" required v-model="password2" :error-messages="registerFieldErrors.password2" :rules="retypePasswordRules" />
								</v-row>
								<v-row v-if="registerFailureMessage">
									{{ registerFailureMessage }}
								</v-row>
							</v-container>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn color="primary" :loading="isLoading" @click="register" :disabled="!registerValid">Register</v-btn>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-tab-item>
		</v-tabs-items>
	</v-sheet>
</template>

<script>
import { API } from "@/common-http.js";
import isEmail from 'validator/es/lib/isEmail';

export default {
	name: "LogIn",
	data() {
		return {
			email: "",
			username: "",
			password: "",
			password2: "",

			mode: "",
			isLoading: false,
			logInFailureMessage: "",
			registerFailureMessage: "",

			loginValid: false,
			registerValid: false,
			registerFieldErrors: {
				email: "",
				username: "",
				password: "",
				password2: "",
			},

			emailRules: [
				v => !!v || "Email is required",
				v => v && isEmail(v) || "Must be a valid email",
			],
			usernameRules: [
				// eslint-disable-next-line array-bracket-newline
				v => !!v || "Username is required",
			],
			passwordRules: [
				v => !!v || "Password is required",
				v => v && v.length >= 10 || process.env.NODE_ENV === "development" && v === "1" || "Password must be at least 10 characters long",
			],
			retypePasswordRules: [
				v => !!v || "Please retype your password",
				v => v === this.password || "Passwords must match",
			],
		};
	},
	created() {
		if (this.$store.state.username) {
			this.username = this.$store.state.username;
		}
	},
	methods: {
		login() {
			this.$refs.loginForm.validate();
			if (!this.loginValid) {
				return;
			}

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
					this.logInFailureMessage = "Something weird happened, but you might be logged in? Refresh the page.";
				}
			}).catch(err => {
				this.isLoading = false;
				if (err.response && !err.response.data.success) {
					if (err.response.data.error) {
						this.logInFailureMessage = err.response.data.error.message;
					}
					else {
						this.logInFailureMessage = "Failed to log in, but the server didn't say why. Report this as a bug.";
					}
				}
				else {
					console.log("could not log in", err, err.response);
					this.logInFailureMessage = "Failed to log in, and I don't know why. Report this as a bug.";
				}
			});
		},
		register() {
			this.$refs.registerForm.validate();
			if (!this.registerValid) {
				return;
			}

			this.isLoading = true;
			this.registerFailureMessage = "";
			this.registerFieldErrors = {
				email: "",
				username: "",
				password: "",
				password2: "",
			};
			API.post("/user/register", { email: this.email, username: this.username, password: this.password }).then(resp => {
				this.isLoading = false;
				if (resp.data.success) {
					console.log("Registeration success");
					this.$store.commit("LOGIN", resp.data.user);
					this.$emit("shouldClose");
					this.email = "";
					this.username = "";
					this.password = "";
					this.password2 = "";
				}
				else {
					console.log("Registeration failed");
					this.registerFailureMessage = "Something weird happened, but you might be logged in? Refresh the page.";
				}
			}).catch(err => {
				this.isLoading = false;
				if (err.response && !err.response.data.success) {
					if (err.response.data.error) {
						if (err.response.data.error.name === "AlreadyInUse") {
							if (err.response.data.error.fields.includes("email")) {
								this.registerFieldErrors.email = "Already in use.";
							}
							if (err.response.data.error.fields.includes("username")) {
								this.registerFieldErrors.username = "Already in use.";
							}
						}
						this.registerFailureMessage = err.response.data.error.message;
					}
					else {
						this.registerFailureMessage = "Failed to register, but the server didn't say why. Report this as a bug.";
					}
				}
				else {
					console.log("could not register", err);
					this.registerFailureMessage = "Failed to register, and I don't know why. Check the console and report this as a bug.";
				}
			});
		},
	},
	watch: {
		email() {
			this.logInFailureMessage = "";
		},
		password() {
			this.logInFailureMessage = "";
		},
	},
};
</script>

<style lang="scss" scoped>

</style>
