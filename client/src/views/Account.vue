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
								<span>{{ account.discordLinked ? $t("account.linked") : $t("account.not-linked") }}</span>
							</div>
							<p v-if="account.discordLinked && !account.hasPassword" class="text-muted social-note">
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
import { API } from "@/common-http";
import { ToastStyle } from "@/models/toast";
import { useStore } from "@/store";
import { goLoginDiscord } from "@/util/discord";
import { useI18n } from "vue-i18n";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { OttApiResponseAccount, OttResponseBody } from "ott-common/models/rest-api";
import isEmail from "validator/es/lib/isEmail";
import toast from "@/util/toast";
import type { VForm } from "vuetify/lib/components/VForm/VForm.mjs";

const { t } = useI18n();
const router = useRouter();
const store = useStore();

const isLoading = ref(false);
const isSavingEmail = ref(false);
const isSavingPassword = ref(false);
const isSavingDiscord = ref(false);
const account = ref<OttApiResponseAccount | null>(null);

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

onMounted(async () => {
	await loadAccount();
});

async function loadAccount() {
	isLoading.value = true;
	try {
		const resp = await API.get<OttResponseBody<OttApiResponseAccount>>("/user/account");
		if (resp.data.success) {
			account.value = resp.data;
			email.value = resp.data.email ?? "";
			if (store.state.user) {
				store.commit("LOGIN", {
					...store.state.user,
					username: resp.data.username,
					loggedIn: true,
					discordLinked: resp.data.discordLinked,
				});
			}
		}
	} catch (err) {
		if (err.response?.status === 401) {
			router.push("/");
			return;
		}
		toast.add({
			style: ToastStyle.Error,
			content: t("account.load-failed"),
			duration: 4000,
		});
	} finally {
		isLoading.value = false;
	}
}

async function saveEmail() {
	emailForm.value?.validate();
	if (!emailValid.value) {
		return;
	}

	isSavingEmail.value = true;
	try {
		const resp = await API.patch<OttResponseBody>("/user/account", {
			email: email.value,
		});
		if (resp.data.success) {
			toast.add({
				style: ToastStyle.Success,
				content: t("account.email-saved"),
				duration: 4000,
			});
			await loadAccount();
		}
	} catch (err) {
		toast.add({
			style: ToastStyle.Error,
			content: err.response?.data?.error?.message ?? t("account.save-failed"),
			duration: 4000,
		});
	} finally {
		isSavingEmail.value = false;
	}
}

async function savePassword() {
	passwordForm.value?.validate();
	if (!passwordValid.value) {
		return;
	}

	isSavingPassword.value = true;
	try {
		const resp = await API.patch<OttResponseBody>("/user/account", {
			currentPassword: currentPassword.value || undefined,
			newPassword: newPassword.value,
		});
		if (resp.data.success) {
			toast.add({
				style: ToastStyle.Success,
				content: t("account.password-saved"),
				duration: 4000,
			});
			newPassword.value = "";
			newPasswordConfirm.value = "";
			currentPassword.value = "";
			await loadAccount();
		}
	} catch (err) {
		toast.add({
			style: ToastStyle.Error,
			content: err.response?.data?.error?.message ?? t("account.save-failed"),
			duration: 4000,
		});
	} finally {
		isSavingPassword.value = false;
	}
}

async function unlinkDiscord() {
	isSavingDiscord.value = true;
	try {
		const resp = await API.delete<OttResponseBody>("/user/account/discord");
		if (resp.data.success) {
			toast.add({
				style: ToastStyle.Success,
				content: t("account.discord-unlinked"),
				duration: 4000,
			});
			await loadAccount();
		}
	} catch (err) {
		toast.add({
			style: ToastStyle.Error,
			content: err.response?.data?.error?.message ?? t("account.save-failed"),
			duration: 4000,
		});
	} finally {
		isSavingDiscord.value = false;
	}
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
