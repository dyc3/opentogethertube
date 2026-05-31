<template>
	<Card class="border-line-strong">
		<Tabs v-model="mode" class="gap-0">
			<CardHeader class="pb-0">
				<TabsList class="w-full">
					<TabsTrigger value="login">{{ $t("login-form.login") }}</TabsTrigger>
					<TabsTrigger value="register">{{ $t("login-form.register") }}</TabsTrigger>
				</TabsList>
			</CardHeader>

			<!-- LOGIN -->
			<TabsContent value="login">
				<form @submit.prevent="login">
					<CardContent class="pt-6">
						<div class="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
							<div class="flex items-center justify-center">
								<Button
									type="button"
									size="lg"
									class="w-full bg-[#7289DA] text-white hover:bg-[#5b6eae]"
									@click="goLoginDiscord"
								>
									<Icon :icon="mdiMessageText" class="size-5" />
									{{ $t("login-form.login-discord") }}
								</Button>
							</div>
							<Separator orientation="vertical" class="hidden md:block" />
							<Separator class="md:hidden" />
							<FieldGroup>
								<Field :data-invalid="!!logInFailureMessage || undefined">
									<FieldLabel for="login-user">
										{{ $t("login-form.email-or-username") }}
									</FieldLabel>
									<Input
										id="login-user"
										v-model="emailOrUsername"
										:disabled="isLoading"
										:aria-invalid="!!logInFailureMessage || undefined"
										data-cy="login-user"
									/>
								</Field>
								<Field :data-invalid="!!logInFailureMessage || undefined">
									<FieldLabel for="login-password">
										{{ $t("login-form.password") }}
									</FieldLabel>
									<Input
										id="login-password"
										v-model="password"
										type="password"
										:disabled="isLoading"
										:aria-invalid="!!logInFailureMessage || undefined"
										data-cy="login-password"
									/>
									<FieldError v-if="logInFailureMessage">
										{{ logInFailureMessage }}
									</FieldError>
								</Field>
								<ForgotPassword @password-reset="$emit('shouldClose')" />
							</FieldGroup>
						</div>
					</CardContent>
					<CardFooter class="justify-end">
						<Button
							type="submit"
							:disabled="!loginValid || isLoading"
							data-cy="login-button"
						>
							<Spinner v-if="isLoading" class="size-4" />
							{{ $t("login-form.login") }}
						</Button>
					</CardFooter>
				</form>
			</TabsContent>

			<!-- REGISTER -->
			<TabsContent value="register">
				<form @submit.prevent="register">
					<CardContent class="pt-6">
						<FieldGroup>
							<Field :data-invalid="showError('email') || undefined">
								<FieldLabel for="reg-email">{{
									$t("login-form.email")
								}}</FieldLabel>
								<Input
									id="reg-email"
									v-model="email"
									:disabled="isLoading"
									:aria-invalid="showError('email') || undefined"
									@blur="touched.email = true"
								/>
								<FieldDescription>{{
									$t("login-form.email-optional")
								}}</FieldDescription>
								<FieldError v-if="showError('email')">{{
									errors.email
								}}</FieldError>
								<FieldError v-if="registerFieldErrors.email">
									{{ registerFieldErrors.email }}
								</FieldError>
							</Field>
							<Field :data-invalid="showError('username') || undefined">
								<FieldLabel for="reg-username">{{
									$t("login-form.username")
								}}</FieldLabel>
								<Input
									id="reg-username"
									v-model="username"
									:disabled="isLoading"
									:aria-invalid="showError('username') || undefined"
									@blur="touched.username = true"
								/>
								<FieldError v-if="showError('username')">{{
									errors.username
								}}</FieldError>
								<FieldError v-if="registerFieldErrors.username">
									{{ registerFieldErrors.username }}
								</FieldError>
							</Field>
							<Field :data-invalid="showError('password') || undefined">
								<FieldLabel for="reg-password">{{
									$t("login-form.password")
								}}</FieldLabel>
								<Input
									id="reg-password"
									v-model="password"
									type="password"
									:disabled="isLoading"
									:aria-invalid="showError('password') || undefined"
									@blur="touched.password = true"
								/>
								<div class="flex justify-end">
									<span class="text-xs text-dim font-mono">{{
										password.length
									}}</span>
								</div>
								<FieldError v-if="showError('password')">{{
									errors.password
								}}</FieldError>
								<FieldError v-if="registerFieldErrors.password">
									{{ registerFieldErrors.password }}
								</FieldError>
							</Field>
							<Field :data-invalid="showError('password2') || undefined">
								<FieldLabel for="reg-password2">
									{{ $t("login-form.retype-password") }}
								</FieldLabel>
								<Input
									id="reg-password2"
									v-model="password2"
									type="password"
									:disabled="isLoading"
									:aria-invalid="showError('password2') || undefined"
									@blur="touched.password2 = true"
								/>
								<FieldError v-if="showError('password2')">{{
									errors.password2
								}}</FieldError>
								<FieldError v-if="registerFieldErrors.password2">
									{{ registerFieldErrors.password2 }}
								</FieldError>
							</Field>
							<p v-if="registerFailureMessage" class="text-sm text-destructive">
								{{ registerFailureMessage }}
							</p>
							<Button
								v-if="!store.state.production"
								type="button"
								variant="outline"
								class="w-fit"
								@click="
									() => {
										username = 'alice';
										password = '12345asdfg';
										password2 = '12345asdfg';
									}
								"
							>
								Sample User 1
							</Button>
						</FieldGroup>
					</CardContent>
					<CardFooter class="justify-end">
						<Button
							type="submit"
							:disabled="!registerValid || isLoading"
							data-cy="register-button"
						>
							<Spinner v-if="isLoading" class="size-4" />
							{{ $t("login-form.register") }}
						</Button>
					</CardFooter>
				</form>
			</TabsContent>
		</Tabs>
	</Card>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mdiMessageText } from "@mdi/js";
import { API } from "@/common-http";
import isEmail from "validator/es/lib/isEmail";
import { USERNAME_LENGTH_MAX } from "ott-common/constants";
import { computed, reactive, ref, watch } from "vue";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { goLoginDiscord } from "@/util/discord";
import ForgotPassword from "./ForgotPassword.vue";

const emit = defineEmits(["shouldClose"]);

const store = useStore();
const { t } = useI18n();

const email = ref("");
const username = ref("");
const emailOrUsername = ref("");
const password = ref("");
const password2 = ref("");

const mode = ref("login");
const isLoading = ref(false);
const logInFailureMessage = ref("");
const registerFailureMessage = ref("");

let registerFieldErrors = reactive({
	email: "",
	username: "",
	password: "",
	password2: "",
});

const touched = reactive({
	email: false,
	username: false,
	password: false,
	password2: false,
});

const loginValid = computed(() => !!emailOrUsername.value && !!password.value);

const errors = computed(() => {
	let emailErr = "";
	if (email.value && !isEmail(email.value)) {
		emailErr = t("login-form.rules.valid-email");
	}

	let usernameErr = "";
	if (!username.value) {
		usernameErr = t("login-form.rules.username-required");
	} else if (username.value.length > USERNAME_LENGTH_MAX) {
		usernameErr = t("login-form.rules.username-length", { length: USERNAME_LENGTH_MAX });
	}

	let passwordErr = "";
	if (!password.value) {
		passwordErr = t("login-form.rules.password-required");
	} else if (!(password.value.length >= 10) && !(import.meta.env.DEV && password.value === "1")) {
		passwordErr = t("login-form.rules.password-length");
	}

	let password2Err = "";
	if (!password2.value) {
		password2Err = t("login-form.rules.retype-password");
	} else if (password.value !== password2.value) {
		password2Err = t("login-form.rules.passwords-match");
	}

	return {
		email: emailErr,
		username: usernameErr,
		password: passwordErr,
		password2: password2Err,
	};
});

const registerValid = computed(() => !Object.values(errors.value).some(Boolean));

function showError(field: keyof typeof errors.value): boolean {
	return touched[field] && !!errors.value[field];
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
	if (!loginValid.value) {
		return;
	}

	isLoading.value = true;
	logInFailureMessage.value = "";
	try {
		const resp = await API.post("/user/login", {
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
			logInFailureMessage.value = t("login-form.errors.something-weird-happened") as string;
		}
	} catch (err) {
		if (err.response && !err.response.data.success) {
			if (err.response.data.error) {
				logInFailureMessage.value = err.response.data.error.message;
			} else {
				logInFailureMessage.value = t("login-form.errors.login-failed-noserver") as string;
			}
		} else {
			console.log("could not log in", err, err.response);
			logInFailureMessage.value = t("login-form.errors.login-failed") as string;
		}
	}
	isLoading.value = false;
}

async function register() {
	touched.email = true;
	touched.username = true;
	touched.password = true;
	touched.password2 = true;
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
		const resp = await API.post("/user/register", {
			email: email.value,
			username: username.value,
			password: password.value,
		});
		if (resp.data.success) {
			console.log("Registration success");
			store.commit("LOGIN", resp.data.user);
			emit("shouldClose");
			email.value = "";
			username.value = "";
			password.value = "";
			password2.value = "";
		} else {
			console.log("Registration failed");
			registerFailureMessage.value = t(
				"login-form.errors.something-weird-happened",
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
						registerFieldErrors.username = t("login-form.errors.in-use") as string;
					}
				}
				registerFailureMessage.value = err.response.data.error.message;
			} else {
				registerFailureMessage.value = t(
					"login-form.errors.register-failed-noserver",
				) as string;
			}
		} else {
			console.log("could not register", err);
			registerFailureMessage.value = t("login-form.errors.register-failed") as string;
		}
	}
	isLoading.value = false;
}
</script>
