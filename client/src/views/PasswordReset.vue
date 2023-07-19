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
			/>
			<v-text-field
				v-model="passwordConfirm"
				:label="$t('login-form.retype-password')"
				type="password"
				required
				:rules="passwordConfirmRules"
			/>
			<v-btn type="submit" color="primary" @click.prevent="submitPasswordReset">
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

async function submitPasswordReset() {
	if (password.value !== passwordConfirm.value) {
		console.error("Passwords do not match");
		return;
	}

	const resp = await API.post<OttResponseBody>("/user/recovery/verify", {
		verifyKey: verifyKey.value,
	});

	if (resp.data.success) {
		toast.add({
			style: ToastStyle.Success,
			content: i18n.t("login-form.change-password.success"),
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
}
</script>
