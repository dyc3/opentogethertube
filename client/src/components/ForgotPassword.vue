<template>
	<a @click.prevent class="link text-primary">
		{{ $t("login-form.change-password.forgot") }}

		<v-dialog activator="parent" v-model="showForgotPassword" width="400">
			<v-container>
				<v-card>
					<v-card-title>
						{{ $t("login-form.change-password.forgot") }}
					</v-card-title>
					<v-form @submit="startPasswordReset">
						<v-card-text>
							{{ $t("login-form.change-password.prompt") }}
							<v-text-field
								:loading="isLoading"
								:label="$t('login-form.email')"
								v-model="email"
							/>
							<v-text-field
								:loading="isLoading"
								:label="$t('login-form.username')"
								v-model="username"
							/>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn
								type="submit"
								color="primary"
								@click.prevent="startPasswordReset"
								:loading="isLoading"
							>
								{{ $t("login-form.change-password.reset") }}
							</v-btn>
						</v-card-actions>
					</v-form>
				</v-card>
			</v-container>
		</v-dialog>
	</a>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import type { OttResponseBody } from "ott-common/models/rest-api";
import toast from "@/util/toast";
import { ToastStyle } from "@/models/toast";
import { API } from "@/common-http";
import { useI18n } from "vue-i18n";

const i18n = useI18n();

const email = ref("");
const username = ref("");

const showForgotPassword = ref(false);
const isLoading = ref(false);

async function startPasswordReset() {
	isLoading.value = true;
	try {
		const resp = await API.post<OttResponseBody>("/user/recover/start", {
			email: email.value ? email.value : undefined,
			username: username.value ? username.value : undefined,
		});

		if (resp.data.success) {
			showForgotPassword.value = false;

			email.value = "";
			username.value = "";
			toast.add({
				style: ToastStyle.Success,
				content: i18n.t("login-form.change-password.sent"),
			});
		} else {
			toast.add({
				style: ToastStyle.Error,
				content: i18n.t("login-form.change-password.failed"),
			});
		}
	} catch (e) {
		toast.add({
			style: ToastStyle.Error,
			content: i18n.t("login-form.change-password.failed"),
		});
		return;
	} finally {
		isLoading.value = false;
	}
}
</script>
