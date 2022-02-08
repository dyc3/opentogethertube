<template>
	<v-sheet>
		<v-tabs v-model="mode">
			<v-tab key="login">{{ $t("login-form.login") }}</v-tab>
			<v-tab key="register">{{ $t("login-form.register") }}</v-tab>
		</v-tabs>
		<v-tabs-items v-model="mode">
			<v-tab-item>
				<v-card>
					<v-form ref="loginForm" @submit.prevent="login" v-model="loginValid" :lazy-validation="false">
						<v-card-title>
							{{ $t("login-form.login") }}
						</v-card-title>
						<v-card-text>
							<v-row>
								<v-col cols="12" md="6">
									<v-container>
										<v-btn x-large block href="/api/auth/discord" color="#7289DA">{{ $t("login-form.login-discord") }}</v-btn>
										<!-- TODO: <v-btn x-large block>Log in with Google</v-btn> -->
									</v-container>
								</v-col>
								<v-divider vertical />
								<v-col cols="12" md="6" style="margin-left: -1px">
									<v-container>
										<v-row>
											<v-text-field :loading="isLoading" :label="$t('login-form.email')" required v-model="email" :error-messages="logInFailureMessage" :rules="emailRules" />
											<v-text-field :loading="isLoading" :label="$t('login-form.password')" type="password" required v-model="password" :error-messages="logInFailureMessage" />
										</v-row>
										<v-row v-if="logInFailureMessage">
											{{ logInFailureMessage }}
										</v-row>
									</v-container>
								</v-col>
							</v-row>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn type="submit" color="primary" :loading="isLoading" @click.prevent="login" :disabled="!loginValid">{{ $t("login-form.login") }}</v-btn>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-tab-item>
			<v-tab-item>
				<v-card>
					<v-form ref="registerForm" @submit.prevent="register" v-model="registerValid" :lazy-validation="false">
						<v-card-title>
							{{ $t("login-form.register") }}
						</v-card-title>
						<v-card-text>
							<v-container>
								<v-row>
									<v-text-field :loading="isLoading" :label="$t('login-form.email')" required v-model="email" :error-messages="registerFieldErrors.email" :rules="emailRules" />
									<v-text-field :loading="isLoading" :label="$t('login-form.username')" required v-model="username" :error-messages="registerFieldErrors.username" :rules="usernameRules" />
									<v-text-field :loading="isLoading" :label="$t('login-form.password')" type="password" required v-model="password" :error-messages="registerFieldErrors.password" :rules="passwordRules" counter />
									<v-text-field :loading="isLoading" :label="$t('login-form.retype-password')" type="password" required v-model="password2" :error-messages="registerFieldErrors.password2" :rules="retypePasswordRules" />
								</v-row>
								<v-row v-if="registerFailureMessage">
									{{ registerFailureMessage }}
								</v-row>
							</v-container>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn type="submit" color="primary" :loading="isLoading" @click.prevent="register" :disabled="!registerValid">{{ $t("login-form.register") }}</v-btn>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-tab-item>
		</v-tabs-items>
	</v-sheet>
</template>

<script>
import Vue from "vue";
import Component from 'vue-class-component';
import { API } from "@/common-http.js";
import isEmail from 'validator/es/lib/isEmail';
import { USERNAME_LENGTH_MAX } from "common/constants";

@Component({
	name: "LogInForm",
	watch: {
		email() {
			this.logInFailureMessage = "";
		},
		password() {
			this.logInFailureMessage = "";
		},
	},
})
export default class LogInForm extends Vue {
	email = ""
	username = ""
	password = ""
	password2 = ""

	mode = ""
	isLoading = false
	logInFailureMessage = ""
	registerFailureMessage = ""

	loginValid = false
	registerValid = false
	registerFieldErrors = {
		email: "",
		username: "",
		password: "",
		password2: "",
	}

	emailRules = [
		v => !!v || this.$t('login-form.rules.email-required'),
		v => v && isEmail(v) || this.$t('login-form.rules.valid-email'),
	]
	usernameRules = [
		v => !!v || this.$t('login-form.rules.username-required'),
		v => !!v && v.length > 0 && v.length <= USERNAME_LENGTH_MAX || this.$t('login-form.rules.username-length', {length: USERNAME_LENGTH_MAX}),
	]
	passwordRules = [
		v => !!v || this.$t('login-form.rules.password-required'),
		v => v && v.length >= 10 || process.env.NODE_ENV === "development" && v === "1" || this.$t('login-form.rules.password-length'),
	]
	retypePasswordRules = [
		v => !!v || this.$t('login-form.rules.retype-password'),
		v => this.comparePassword(v) || this.$t('login-form.rules.passwords-match'),
	]

	created() {
		if (this.$store.state.username) {
			this.username = this.$store.state.username;
		}
	}

	async login() {
		this.$refs.loginForm.validate();
		if (!this.loginValid) {
			return;
		}

		this.isLoading = true;
		this.logInFailureMessage = "";
		try {
			let resp = await API.post("/user/login", { email: this.email, password: this.password });
			if (resp.data.success) {
				console.log("Log in success");
				this.$store.commit("LOGIN", resp.data.user);
				this.$emit("shouldClose");
				this.email = "";
				this.password = "";
			}
			else {
				console.log("Log in failed");
				this.logInFailureMessage = this.$t('login-form.errors.something-weird-happened');
			}
		}
		catch (err) {
			if (err.response && !err.response.data.success) {
				if (err.response.data.error) {
					this.logInFailureMessage = err.response.data.error.message;
				}
				else {
					this.logInFailureMessage = this.$t('login-form.errors.login-failed-noserver');
				}
			}
			else {
				console.log("could not log in", err, err.response);
				this.logInFailureMessage = this.$t('login-form.errors.login-failed');
			}
		}
		this.isLoading = false;
	}

	async register() {
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
		try {
			let resp = await API.post("/user/register", { email: this.email, username: this.username, password: this.password });
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
				this.registerFailureMessage = this.$t('login-form.errors.something-weird-happened');
			}
		}
		catch (err) {
			if (err.response && !err.response.data.success) {
				if (err.response.data.error) {
					if (err.response.data.error.name === "AlreadyInUse") {
						if (err.response.data.error.fields.includes("email")) {
							this.registerFieldErrors.email = this.$t('login-form.errors.in-use');
						}
						if (err.response.data.error.fields.includes("username")) {
							this.registerFieldErrors.username = this.$t('login-form.errors.in-use');
						}
					}
					this.registerFailureMessage = err.response.data.error.message;
				}
				else {
					this.registerFailureMessage = this.$t('login-form.errors.register-failed-noserver');
				}
			}
			else {
				console.log("could not register", err);
				this.registerFailureMessage = this.$t('login-form.errors.register-failed');
			}
		}
		this.isLoading = false;
	}

	comparePassword(v) {
		// HACK: required because otherwise this.password is undefined for some reason in the validation rule's context
		return this.password === v;
	}
}
</script>

<style lang="scss" scoped>

</style>
