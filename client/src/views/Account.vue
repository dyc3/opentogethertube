<template>
	<v-container>
		<v-row v-if="isLoading" justify="center">
			<v-col cols="12" class="text-center">
				<v-progress-circular indeterminate />
			</v-col>
		</v-row>

		<template v-else-if="account">
			<v-row>
				<v-col cols="12" md="8" lg="6">
					<h1>{{ $t("account.title") }}</h1>
					<p>{{ $t("account.description") }}</p>
				</v-col>
			</v-row>

			<v-row>
				<v-col cols="12" md="8" lg="6">
					<v-card>
						<v-card-title>{{ $t("account.details") }}</v-card-title>
						<v-card-text>
							<div class="account-row">
								<strong>{{ $t("account.username") }}</strong>
								<span>{{ account.username }}</span>
							</div>
							<div class="account-row">
								<strong>{{ $t("account.email") }}</strong>
								<span>{{ account.email ?? $t("account.no-email") }}</span>
							</div>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>

			<v-row>
				<v-col cols="12" md="8" lg="6">
					<v-card>
						<v-card-title>{{ $t("account.social") }}</v-card-title>
						<v-card-text>
							<div class="account-row">
								<strong>{{ $t("account.discord") }}</strong>
								<span>{{
									account.discordLinked
										? $t("account.linked")
										: $t("account.not-linked")
								}}</span>
							</div>
							<p
								v-if="account.discordLinked && !account.hasPassword"
								class="text-muted social-note"
							>
								{{ $t("account.discord-unlink-requires-password") }}
							</p>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn
								v-if="!account.discordLinked"
								color="primary"
								data-cy="account-link-discord"
								@click="goLoginDiscord"
							>
								{{ $t("account.link-discord") }}
							</v-btn>
							<v-btn
								v-else
								color="error"
								variant="flat"
								data-cy="account-unlink-discord"
								:disabled="!account.hasPassword"
								:loading="isSavingDiscord"
								@click="unlinkDiscord"
							>
								{{ $t("account.unlink-discord") }}
							</v-btn>
						</v-card-actions>
					</v-card>
				</v-col>
			</v-row>

			<v-row>
				<v-col cols="12" md="8" lg="6">
					<v-card>
						<v-card-title>{{ emailFormTitle }}</v-card-title>
						<v-form ref="emailForm" v-model="emailValid" @submit.prevent="saveEmail">
							<v-card-text>
								<v-text-field
									v-model="email"
									data-cy="account-email"
									:label="$t('account.email')"
									:loading="isSavingEmail"
									:rules="emailRules"
									required
								/>
							</v-card-text>
							<v-card-actions>
								<v-spacer />
								<v-btn
									color="primary"
									type="submit"
									data-cy="account-save-email"
									:loading="isSavingEmail"
									:disabled="!emailValid"
								>
									{{ emailSubmitText }}
								</v-btn>
							</v-card-actions>
						</v-form>
					</v-card>
				</v-col>
			</v-row>

			<v-row>
				<v-col cols="12" md="8" lg="6">
					<v-card>
						<v-card-title>{{ passwordFormTitle }}</v-card-title>
						<v-form
							ref="passwordForm"
							v-model="passwordValid"
							@submit.prevent="savePassword"
						>
							<v-card-text>
								<v-text-field
									v-if="account.hasPassword"
									v-model="currentPassword"
									data-cy="account-current-password"
									:label="$t('account.current-password')"
									type="password"
									:loading="isSavingPassword"
									:rules="currentPasswordRules"
									required
								/>
								<v-text-field
									v-model="newPassword"
									data-cy="account-new-password"
									:label="$t('login-form.password')"
									type="password"
									:loading="isSavingPassword"
									:rules="passwordRules"
									required
								/>
								<v-text-field
									v-model="newPasswordConfirm"
									data-cy="account-new-password-confirm"
									:label="$t('login-form.retype-password')"
									type="password"
									:loading="isSavingPassword"
									:rules="passwordConfirmRules"
									required
								/>
							</v-card-text>
							<v-card-actions>
								<v-spacer />
								<v-btn
									color="primary"
									type="submit"
									data-cy="account-save-password"
									:loading="isSavingPassword"
									:disabled="!passwordValid"
								>
									{{ passwordSubmitText }}
								</v-btn>
							</v-card-actions>
						</v-form>
					</v-card>
				</v-col>
			</v-row>
		</template>
	</v-container>
</template>

<script lang="ts" setup>
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { AxiosError } from "axios";
import type { OttApiResponseAccount, OttResponseBody } from "ott-common/models/rest-api";
import isEmail from "validator/es/lib/isEmail";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { VForm } from "vuetify/lib/components/VForm/VForm.mjs";
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

const emailValid = ref(false);
const passwordValid = ref(false);

const emailForm = ref<VForm | undefined>(null);
const passwordForm = ref<VForm | undefined>(null);

const emailRules = [
	v => !!v || t("login-form.rules.email-required"),
	v => (v && isEmail(v)) || t("login-form.rules.valid-email"),
];
const passwordRules = [
	v => !!v || t("login-form.rules.password-required"),
	v =>
		(v && v.length >= 10) ||
		(import.meta.env.DEV && v === "1") ||
		t("login-form.rules.password-length"),
];
const currentPasswordRules = [v => !!v || t("account.current-password-required")];
const passwordConfirmRules = [
	v => !!v || t("login-form.rules.retype-password"),
	v => (v && v === newPassword.value) || t("login-form.rules.passwords-match"),
];

const emailFormTitle = computed(() =>
	account.value?.email ? t("account.change-email") : t("account.add-email")
);
const emailSubmitText = computed(() =>
	account.value?.email ? t("account.save-email") : t("account.add-email")
);
const passwordFormTitle = computed(() =>
	account.value?.hasPassword ? t("account.change-password") : t("account.add-password")
);
const passwordSubmitText = computed(() =>
	account.value?.hasPassword ? t("account.save-password") : t("account.add-password")
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
	{ immediate: true }
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
	}
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
	emailForm.value?.validate();
	if (!emailValid.value) {
		return;
	}
	await saveEmailMutation.mutateAsync().catch(() => undefined);
}

async function savePassword() {
	passwordForm.value?.validate();
	if (!passwordValid.value) {
		return;
	}
	await savePasswordMutation.mutateAsync().catch(() => undefined);
}

async function unlinkDiscord() {
	await unlinkDiscordMutation.mutateAsync().catch(() => undefined);
}
</script>

<style lang="scss" scoped>
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
