<template>
	<v-container>
		<v-form @submit="submitPasswordReset">
			<h1>{{ $t("login-form.change-password.title") }}</h1>
			<v-text-field
				v-model="password"
				:label="$t('login-form.password')"
				type="password"
				required
				:rules="passwordRules"
				:loading="isLoading"
			/>
			<v-text-field
				v-model="passwordConfirm"
				:label="$t('login-form.retype-password')"
				type="password"
				required
				:rules="passwordConfirmRules"
				:loading="isLoading"
			/>
			<v-btn
				type="submit"
				color="primary"
				@click.prevent="submitPasswordReset"
				:loading="isLoading"
			>
				{{ $t("common.save") }}
			</v-btn>
		</v-form>
	</v-container>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { API } from "@/common-http";
import { useRoute, useRouter } from "vue-router";
import { OttResponseBody } from "ott-common/models/rest-api";
import { useI18n } from "vue-i18n";
import { useStore } from "@/store";
import toast from "@/util/toast";
import { ToastStyle } from "@/models/toast";

const router = useRouter();
const route = useRoute();
const i18n = useI18n();
const store = useStore();

const verifyKey = ref(route.query.verifyKey);
const password = ref("");
const passwordConfirm = ref("");

const passwordRules = [v => !!v || i18n.t("login-form.rules.password-required")];

const passwordConfirmRules = [
	v => !!v || i18n.t("login-form.rules.password-required"),
	v => (v && v === password.value) || i18n.t("login-form.rules.passwords-match"),
];

onMounted(async () => {
	if (!verifyKey.value) {
		console.error("No verify key provided");
		router.push("/");
	}
});

const isLoading = ref(false);

async function submitPasswordReset() {
	if (password.value !== passwordConfirm.value) {
		console.error("Passwords do not match");
		return;
	}

	isLoading.value = true;
	try {
		const resp = await API.post<OttResponseBody>("/user/recover/verify", {
			verifyKey: verifyKey.value,
			newPassword: password.value,
		});

		if (resp.data.success) {
			toast.add({
				style: ToastStyle.Success,
				content: i18n.t("login-form.change-password.success"),
				duration: 4000,
			});
			const resp = await API.get("/user");
			if (resp.data.loggedIn) {
				const user = resp.data;
				delete user.loggedIn;
				store.commit("LOGIN", user);
			} else {
				console.warn("Didn't get logged in user after password reset.");
			}
			router.push("/");
		}
	} catch (error) {
		console.error(error);
		const msg = error.response?.data?.name
			? i18n.t(`errors.${error.response.data.name}`)
			: i18n.t("login-form.change-password.failed");
		toast.add({
			style: ToastStyle.Error,
			content: msg,
			duration: 4000,
		});
	} finally {
		isLoading.value = false;
	}
}
</script>
