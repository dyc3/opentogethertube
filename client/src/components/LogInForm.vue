<template>
	<v-sheet>
		<v-tabs v-model="mode">
			<v-tab key="login">{{ $t("login-form.login") }}</v-tab>
			<v-tab key="register">{{ $t("login-form.register") }}</v-tab>
		</v-tabs>
		<v-window v-model="mode">
			<v-window-item>
				<v-card>
					<v-form
						ref="loginForm"
						@submit.prevent="login"
						v-model="loginValid"
						:lazy-validation="false"
					>
						<v-card-title>
							{{ $t("login-form.login") }}
						</v-card-title>
						<v-card-text>
							<v-row>
								<v-col cols="12" md="6">
									<v-container>
										<v-btn
											size="x-large"
											block
											href="/api/auth/discord"
											color="#7289DA"
											>{{ $t("login-form.login-discord") }}</v-btn
										>
										<!-- TODO: <v-btn size="x-large" block>Log in with Google</v-btn> -->
									</v-container>
								</v-col>
								<v-divider vertical />
								<v-col cols="12" md="6" style="margin-left: -1px">
									<v-container>
										<v-row>
											<v-col>
												<v-text-field
													:loading="isLoading"
													:label="$t('login-form.email-or-username')"
													required
													v-model="emailOrUsername"
													:error-messages="logInFailureMessage"
													data-cy="login-user"
												/>
												<v-text-field
													:loading="isLoading"
													:label="$t('login-form.password')"
													type="password"
													required
													v-model="password"
													:error-messages="logInFailureMessage"
													data-cy="login-password"
												/>
											</v-col>
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
							<v-btn
								type="submit"
								color="primary"
								:loading="isLoading"
								@click.prevent="login"
								:disabled="!loginValid"
								data-cy="login-button"
								>{{ $t("login-form.login") }}</v-btn
							>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-window-item>
			<v-window-item>
				<v-card>
					<v-form
						ref="registerForm"
						@submit.prevent="register"
						v-model="registerValid"
						:lazy-validation="false"
					>
						<v-card-title>
							{{ $t("login-form.register") }}
						</v-card-title>
						<v-card-text>
							<v-container>
								<v-row>
									<v-col>
										<v-text-field
											:loading="isLoading"
											:label="$t('login-form.email')"
											required
											v-model="email"
											:error-messages="registerFieldErrors.email"
											:rules="emailRules"
											:hint="$t('login-form.email-optional')"
										/>
										<v-text-field
											:loading="isLoading"
											:label="$t('login-form.username')"
											required
											v-model="username"
											:error-messages="registerFieldErrors.username"
											:rules="usernameRules"
										/>
										<v-text-field
											:loading="isLoading"
											:label="$t('login-form.password')"
											type="password"
											required
											v-model="password"
											:error-messages="registerFieldErrors.password"
											:rules="passwordRules"
											counter
										/>
										<v-text-field
											:loading="isLoading"
											:label="$t('login-form.retype-password')"
											type="password"
											required
											v-model="password2"
											:error-messages="registerFieldErrors.password2"
											:rules="retypePasswordRules"
										/>
									</v-col>
								</v-row>
								<v-row v-if="registerFailureMessage">
									{{ registerFailureMessage }}
								</v-row>
							</v-container>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn
								type="submit"
								color="primary"
								:loading="isLoading"
								@click.prevent="register"
								:disabled="!registerValid"
								data-cy="register-button"
								>{{ $t("login-form.register") }}</v-btn
							>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-window-item>
		</v-window>
	</v-sheet>
</template>

<script lang="ts">
import { API } from "@/common-http";
import isEmail from "validator/es/lib/isEmail";
import { USERNAME_LENGTH_MAX } from "ott-common/constants";
import { defineComponent, reactive, ref, watch } from "vue";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { VForm } from "vuetify/lib/components/VForm/VForm.mjs";

const LogInForm = defineComponent({
	name: "LogInForm",
	emits: ["shouldClose"],
	setup(props, { emit }) {
		const store = useStore();
		const { t } = useI18n();

		let email = ref("");
		let username = ref("");
		let emailOrUsername = ref("");
		let password = ref("");
		let password2 = ref("");

		let mode = ref("");
		let isLoading = ref(false);
		let logInFailureMessage = ref("");
		let registerFailureMessage = ref("");

		let loginValid = ref(false);
		let registerValid = ref(false);
		let registerFieldErrors = reactive({
			email: "",
			username: "",
			password: "",
			password2: "",
		});

		// magic line that grabs a static ref to the DOM element/component with ref="loginForm"
		const loginForm = ref<VForm | undefined>(null);
		const registerForm = ref<VForm | undefined>(null);

		const emailRules = [v => (v && isEmail(v)) || !v || t("login-form.rules.valid-email")];
		const usernameRules = [
			v => !!v || t("login-form.rules.username-required"),
			v =>
				(!!v && v.length > 0 && v.length <= USERNAME_LENGTH_MAX) ||
				t("login-form.rules.username-length", { length: USERNAME_LENGTH_MAX }),
		];

		const passwordRules = [
			v => !!v || t("login-form.rules.password-required"),
			v =>
				(v && v.length >= 10) ||
				(import.meta.env.NODE_ENV === "development" && v === "1") ||
				t("login-form.rules.password-length"),
		];
		const retypePasswordRules = [
			v => !!v || t("login-form.rules.retype-password"),
			v => comparePassword(v) || t("login-form.rules.passwords-match"),
		];

		function comparePassword(v: string) {
			// HACK: required because otherwise this.password is undefined for some reason in the validation rule's context
			return password.value === v;
		}

		watch(email, () => {
			logInFailureMessage.value = "";
			registerFailureMessage.value = "";
			registerFieldErrors.email = "";
		});
		watch(password, () => {
			logInFailureMessage.value = "";
		});
		watch(username, () => {
			registerFailureMessage.value = "";
			registerFieldErrors.username = "";
		});

		async function login() {
			loginForm.value.validate();
			if (!loginValid.value) {
				return;
			}

			isLoading.value = true;
			logInFailureMessage.value = "";
			try {
				let resp = await API.post("/user/login", {
					user: emailOrUsername.value,
					password: password.value,
				});
				if (resp.data.success) {
					console.log("Log in success");
					store.commit("LOGIN", resp.data.user);
					emit("shouldClose");
					emailOrUsername.value = "";
					password.value = "";
				} else {
					console.log("Log in failed");
					logInFailureMessage.value = t(
						"login-form.errors.something-weird-happened"
					) as string;
				}
			} catch (err) {
				if (err.response && !err.response.data.success) {
					if (err.response.data.error) {
						logInFailureMessage.value = err.response.data.error.message;
					} else {
						logInFailureMessage.value = t(
							"login-form.errors.login-failed-noserver"
						) as string;
					}
				} else {
					console.log("could not log in", err, err.response);
					logInFailureMessage.value = t("login-form.errors.login-failed") as string;
				}
			}
			isLoading.value = false;
		}

		async function register() {
			registerForm.value.validate();
			if (!registerValid.value) {
				return;
			}

			isLoading.value = true;
			registerFailureMessage.value = "";
			registerFieldErrors = {
				email: "",
				username: "",
				password: "",
				password2: "",
			};
			try {
				let resp = await API.post("/user/register", {
					email: email.value,
					username: username.value,
					password: password.value,
				});
				if (resp.data.success) {
					console.log("Registeration success");
					store.commit("LOGIN", resp.data.user);
					emit("shouldClose");
					email.value = "";
					username.value = "";
					password.value = "";
					password2.value = "";
				} else {
					console.log("Registeration failed");
					registerFailureMessage.value = t(
						"login-form.errors.something-weird-happened"
					) as string;
				}
			} catch (err) {
				if (err.response && !err.response.data.success) {
					if (err.response.data.error) {
						if (err.response.data.error.name === "AlreadyInUse") {
							if (err.response.data.error.fields.includes("email")) {
								registerFieldErrors.email = t("login-form.errors.in-use") as string;
							}
							if (err.response.data.error.fields.includes("username")) {
								registerFieldErrors.username = t(
									"login-form.errors.in-use"
								) as string;
							}
						}
						registerFailureMessage.value = err.response.data.error.message;
					} else {
						registerFailureMessage.value = t(
							"login-form.errors.register-failed-noserver"
						) as string;
					}
				} else {
					console.log("could not register", err);
					registerFailureMessage.value = t("login-form.errors.register-failed") as string;
				}
			}
			isLoading.value = false;
		}

		return {
			email,
			username,
			emailOrUsername,
			password,
			password2,
			mode,
			isLoading,
			logInFailureMessage,
			registerFailureMessage,
			loginValid,
			registerValid,
			registerFieldErrors,

			loginForm,
			registerForm,

			emailRules,
			usernameRules,
			passwordRules,
			retypePasswordRules,

			login,
			register,
		};
	},
});

export default LogInForm;
</script>

<style lang="scss" scoped></style>
