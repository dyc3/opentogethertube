<template>
	<div class="mx-auto max-w-md px-6 py-16">
		<Card class="border-line-strong">
			<form @submit.prevent="submitPasswordReset">
				<CardHeader>
					<span class="label-mono text-signal">Reset</span>
					<CardTitle class="text-2xl tracking-wide">
						{{ $t("login-form.change-password.title") }}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field :data-invalid="showPasswordError || undefined">
							<FieldLabel for="pwr-password">{{ $t("login-form.password") }}</FieldLabel>
							<Input
								id="pwr-password"
								v-model="password"
								type="password"
								:aria-invalid="showPasswordError || undefined"
								@blur="touched.password = true"
							/>
							<FieldError v-if="showPasswordError">{{ errors.password }}</FieldError>
						</Field>
						<Field :data-invalid="showConfirmError || undefined">
							<FieldLabel for="pwr-confirm">
								{{ $t("login-form.retype-password") }}
							</FieldLabel>
							<Input
								id="pwr-confirm"
								v-model="passwordConfirm"
								type="password"
								:aria-invalid="showConfirmError || undefined"
								@blur="touched.confirm = true"
							/>
							<FieldError v-if="showConfirmError">{{ errors.confirm }}</FieldError>
						</Field>
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<Button type="submit" class="w-full" :disabled="isLoading">
						<Spinner v-if="isLoading" class="size-4" />
						{{ $t("common.save") }}
					</Button>
				</CardFooter>
			</form>
		</Card>
	</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { API } from "@/common-http";
import { useRoute, useRouter } from "vue-router";
import type { OttResponseBody } from "ott-common/models/rest-api";
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
const touched = reactive({ password: false, confirm: false });

const errors = computed(() => {
	let pw = "";
	if (!password.value) {
		pw = i18n.t("login-form.rules.password-required");
	}
	let confirm = "";
	if (!passwordConfirm.value) {
		confirm = i18n.t("login-form.rules.password-required");
	} else if (passwordConfirm.value !== password.value) {
		confirm = i18n.t("login-form.rules.passwords-match");
	}
	return { password: pw, confirm };
});

const showPasswordError = computed(() => touched.password && !!errors.value.password);
const showConfirmError = computed(() => touched.confirm && !!errors.value.confirm);

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
