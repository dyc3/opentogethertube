<template>
	<div class="mx-auto max-w-2xl px-6 py-12">
		<div v-if="isLoading" class="flex min-h-[40vh] items-center justify-center">
			<Spinner class="size-10 text-primary" />
		</div>

		<template v-else-if="account">
			<div class="mb-8">
				<span class="label-mono text-signal">Your pass</span>
				<h1 class="section-title font-display text-4xl tracking-wide">
					{{ $t("account.title") }}
				</h1>
				<p class="mt-3 text-muted-foreground">{{ $t("account.description") }}</p>
			</div>

			<div class="flex flex-col gap-6">
				<Card class="border-line-strong">
					<CardHeader>
						<CardTitle class="text-xl tracking-wide">{{
							$t("account.details")
						}}</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="account-row">
							<strong class="text-foreground">{{ $t("account.username") }}</strong>
							<span class="text-muted-foreground">{{ account.username }}</span>
						</div>
						<div class="account-row">
							<strong class="text-foreground">{{ $t("account.email") }}</strong>
							<span class="text-muted-foreground">
								{{ account.email ?? $t("account.no-email") }}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card class="border-line-strong">
					<CardHeader>
						<CardTitle class="text-xl tracking-wide">{{
							$t("account.social")
						}}</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="account-row">
							<strong class="text-foreground">{{ $t("account.discord") }}</strong>
							<span class="text-muted-foreground">
								{{
									account.discordLinked
										? $t("account.linked")
										: $t("account.not-linked")
								}}
							</span>
						</div>
						<p
							v-if="account.discordLinked && !account.hasPassword"
							class="social-note text-sm text-muted-foreground"
						>
							{{ $t("account.discord-unlink-requires-password") }}
						</p>
					</CardContent>
					<CardFooter class="justify-end">
						<Button
							v-if="!account.discordLinked"
							data-cy="account-link-discord"
							@click="goLoginDiscord"
						>
							{{ $t("account.link-discord") }}
						</Button>
						<Button
							v-else
							variant="destructive"
							data-cy="account-unlink-discord"
							:disabled="!account.hasPassword || isSavingDiscord"
							@click="unlinkDiscord"
						>
							<Spinner v-if="isSavingDiscord" class="size-4" />
							{{ $t("account.unlink-discord") }}
						</Button>
					</CardFooter>
				</Card>

				<Card class="border-line-strong">
					<CardHeader>
						<CardTitle class="text-xl tracking-wide">{{ emailFormTitle }}</CardTitle>
					</CardHeader>
					<form @submit.prevent="saveEmail">
						<CardContent>
							<Field :data-invalid="showEmailError || undefined">
								<FieldLabel for="account-email">{{
									$t("account.email")
								}}</FieldLabel>
								<Input
									id="account-email"
									v-model="email"
									data-cy="account-email"
									:aria-invalid="showEmailError || undefined"
									required
									@blur="touched.email = true"
								/>
								<FieldError v-if="showEmailError">{{ emailError }}</FieldError>
							</Field>
						</CardContent>
						<CardFooter class="justify-end">
							<Button
								type="submit"
								data-cy="account-save-email"
								:disabled="!emailValid || isSavingEmail"
							>
								<Spinner v-if="isSavingEmail" class="size-4" />
								{{ emailSubmitText }}
							</Button>
						</CardFooter>
					</form>
				</Card>

				<Card class="border-line-strong">
					<CardHeader>
						<CardTitle class="text-xl tracking-wide">{{ passwordFormTitle }}</CardTitle>
					</CardHeader>
					<form @submit.prevent="savePassword">
						<CardContent>
							<FieldGroup>
								<Field
									v-if="account.hasPassword"
									:data-invalid="showCurrentPasswordError || undefined"
								>
									<FieldLabel for="account-current-password">
										{{ $t("account.current-password") }}
									</FieldLabel>
									<Input
										id="account-current-password"
										v-model="currentPassword"
										data-cy="account-current-password"
										type="password"
										:aria-invalid="showCurrentPasswordError || undefined"
										required
										@blur="touched.currentPassword = true"
									/>
									<FieldError v-if="showCurrentPasswordError">
										{{ currentPasswordError }}
									</FieldError>
								</Field>
								<Field :data-invalid="showNewPasswordError || undefined">
									<FieldLabel for="account-new-password">
										{{ $t("login-form.password") }}
									</FieldLabel>
									<Input
										id="account-new-password"
										v-model="newPassword"
										data-cy="account-new-password"
										type="password"
										:aria-invalid="showNewPasswordError || undefined"
										required
										@blur="touched.newPassword = true"
									/>
									<FieldError v-if="showNewPasswordError">
										{{ newPasswordError }}
									</FieldError>
								</Field>
								<Field :data-invalid="showConfirmError || undefined">
									<FieldLabel for="account-new-password-confirm">
										{{ $t("login-form.retype-password") }}
									</FieldLabel>
									<Input
										id="account-new-password-confirm"
										v-model="newPasswordConfirm"
										data-cy="account-new-password-confirm"
										type="password"
										:aria-invalid="showConfirmError || undefined"
										required
										@blur="touched.confirm = true"
									/>
									<FieldError v-if="showConfirmError">
										{{ confirmError }}
									</FieldError>
								</Field>
							</FieldGroup>
						</CardContent>
						<CardFooter class="justify-end">
							<Button
								type="submit"
								data-cy="account-save-password"
								:disabled="!passwordValid || isSavingPassword"
							>
								<Spinner v-if="isSavingPassword" class="size-4" />
								{{ passwordSubmitText }}
							</Button>
						</CardFooter>
					</form>
				</Card>
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { AxiosError } from "axios";
import type { OttApiResponseAccount, OttResponseBody } from "ott-common/models/rest-api";
import isEmail from "validator/es/lib/isEmail";
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { API } from "@/common-http";
import { ToastStyle } from "@/models/toast";
import { useStore } from "@/store";
import { goLoginDiscord } from "@/util/discord";
import toast from "@/util/toast";

const { t } = useI18n();
const router = useRouter();
const store = useStore();
const queryClient = useQueryClient();

const email = ref("");
const currentPassword = ref("");
const newPassword = ref("");
const newPasswordConfirm = ref("");

const touched = reactive({
	email: false,
	currentPassword: false,
	newPassword: false,
	confirm: false,
});

const emailError = computed(() => {
	if (!email.value) {
		return t("login-form.rules.email-required");
	}
	if (!isEmail(email.value)) {
		return t("login-form.rules.valid-email");
	}
	return "";
});
const currentPasswordError = computed(() =>
	!currentPassword.value ? t("account.current-password-required") : "",
);
const newPasswordError = computed(() => {
	if (!newPassword.value) {
		return t("login-form.rules.password-required");
	}
	if (newPassword.value.length < 10 && !(import.meta.env.DEV && newPassword.value === "1")) {
		return t("login-form.rules.password-length");
	}
	return "";
});
const confirmError = computed(() => {
	if (!newPasswordConfirm.value) {
		return t("login-form.rules.retype-password");
	}
	if (newPasswordConfirm.value !== newPassword.value) {
		return t("login-form.rules.passwords-match");
	}
	return "";
});

const emailValid = computed(() => !emailError.value);
const passwordValid = computed(() => {
	const needsCurrent = account.value?.hasPassword;
	return (
		(!needsCurrent || !currentPasswordError.value) &&
		!newPasswordError.value &&
		!confirmError.value
	);
});

const showEmailError = computed(() => touched.email && !!emailError.value);
const showCurrentPasswordError = computed(
	() => touched.currentPassword && !!currentPasswordError.value,
);
const showNewPasswordError = computed(() => touched.newPassword && !!newPasswordError.value);
const showConfirmError = computed(() => touched.confirm && !!confirmError.value);

const emailFormTitle = computed(() =>
	account.value?.email ? t("account.change-email") : t("account.add-email"),
);
const emailSubmitText = computed(() =>
	account.value?.email ? t("account.save-email") : t("account.add-email"),
);
const passwordFormTitle = computed(() =>
	account.value?.hasPassword ? t("account.change-password") : t("account.add-password"),
);
const passwordSubmitText = computed(() =>
	account.value?.hasPassword ? t("account.save-password") : t("account.add-password"),
);

type OttApiErrorPayload = {
	error?: {
		message?: string;
	};
};

function getErrorMessage(err: unknown) {
	if (err instanceof AxiosError) {
		return (err.response?.data as OttApiErrorPayload | undefined)?.error?.message;
	}
	return undefined;
}

const accountQuery = useQuery({
	queryKey: ["account"],
	queryFn: async () => {
		const resp = await API.get<OttResponseBody<OttApiResponseAccount>>("/user/account");
		if (!resp.data.success) {
			throw new Error("Failed to load account");
		}
		return resp.data;
	},
	retry: false,
});

const account = computed(() => accountQuery.data.value ?? null);
const isLoading = computed(() => accountQuery.isPending.value);
const isSavingEmail = computed(() => saveEmailMutation.isPending.value);
const isSavingPassword = computed(() => savePasswordMutation.isPending.value);
const isSavingDiscord = computed(() => unlinkDiscordMutation.isPending.value);

watch(
	() => accountQuery.data.value,
	data => {
		if (!data) {
			return;
		}
		email.value = data.email ?? "";
		if (store.state.user) {
			store.commit("LOGIN", {
				...store.state.user,
				username: data.username,
				loggedIn: true,
				discordLinked: data.discordLinked,
			});
		}
	},
	{ immediate: true },
);

watch(
	() => accountQuery.error.value,
	err => {
		if (!err) {
			return;
		}
		if (err instanceof AxiosError && err.response?.status === 401) {
			router.push("/");
			return;
		}
		toast.add({
			style: ToastStyle.Error,
			content: t("account.load-failed"),
			duration: 4000,
		});
	},
);

const saveEmailMutation = useMutation({
	mutationFn: async () => {
		const resp = await API.patch<OttResponseBody>("/user/account", {
			email: email.value,
		});
		if (!resp.data.success) {
			throw new Error("Failed to save email");
		}
		return resp.data;
	},
	onSuccess: async () => {
		toast.add({
			style: ToastStyle.Success,
			content: t("account.email-saved"),
			duration: 4000,
		});
		await queryClient.invalidateQueries({ queryKey: ["account"] });
	},
	onError: err => {
		toast.add({
			style: ToastStyle.Error,
			content: getErrorMessage(err) ?? t("account.save-failed"),
			duration: 4000,
		});
	},
});

const savePasswordMutation = useMutation({
	mutationFn: async () => {
		const resp = await API.patch<OttResponseBody>("/user/account", {
			currentPassword: currentPassword.value || undefined,
			newPassword: newPassword.value,
		});
		if (!resp.data.success) {
			throw new Error("Failed to save password");
		}
		return resp.data;
	},
	onSuccess: async () => {
		toast.add({
			style: ToastStyle.Success,
			content: t("account.password-saved"),
			duration: 4000,
		});
		newPassword.value = "";
		newPasswordConfirm.value = "";
		currentPassword.value = "";
		await queryClient.invalidateQueries({ queryKey: ["account"] });
	},
	onError: err => {
		toast.add({
			style: ToastStyle.Error,
			content: getErrorMessage(err) ?? t("account.save-failed"),
			duration: 4000,
		});
	},
});

const unlinkDiscordMutation = useMutation({
	mutationFn: async () => {
		const resp = await API.delete<OttResponseBody>("/user/account/discord");
		if (!resp.data.success) {
			throw new Error("Failed to unlink Discord");
		}
		return resp.data;
	},
	onSuccess: async () => {
		toast.add({
			style: ToastStyle.Success,
			content: t("account.discord-unlinked"),
			duration: 4000,
		});
		await queryClient.invalidateQueries({ queryKey: ["account"] });
	},
	onError: err => {
		toast.add({
			style: ToastStyle.Error,
			content: getErrorMessage(err) ?? t("account.save-failed"),
			duration: 4000,
		});
	},
});

async function saveEmail() {
	touched.email = true;
	if (!emailValid.value) {
		return;
	}
	await saveEmailMutation.mutateAsync().catch(() => undefined);
}

async function savePassword() {
	touched.currentPassword = true;
	touched.newPassword = true;
	touched.confirm = true;
	if (!passwordValid.value) {
		return;
	}
	await savePasswordMutation.mutateAsync().catch(() => undefined);
}

async function unlinkDiscord() {
	await unlinkDiscordMutation.mutateAsync().catch(() => undefined);
}
</script>

<style scoped>
.section-title {
	position: relative;
	padding-left: 1rem;
	margin-top: 0.25rem;
}
.section-title::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0.1em;
	bottom: 0.1em;
	width: 4px;
	background: var(--primary);
	box-shadow: 0 0 12px var(--primary);
}

.account-row {
	display: flex;
	justify-content: space-between;
	gap: 16px;
	padding: 6px 0;
}

.social-note {
	margin: 8px 0 0;
}
</style>
