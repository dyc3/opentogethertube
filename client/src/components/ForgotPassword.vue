<template>
	<Dialog v-model:open="showForgotPassword">
		<DialogTrigger as-child>
			<a href="#" class="link text-primary" @click.prevent="showForgotPassword = true">
				{{ $t("login-form.change-password.forgot") }}
			</a>
		</DialogTrigger>
		<DialogContent class="max-w-md sm:max-w-md">
			<DialogHeader>
				<DialogTitle class="font-display text-2xl tracking-wide">
					{{ $t("login-form.change-password.forgot") }}
				</DialogTitle>
			</DialogHeader>
			<form class="flex flex-col gap-4" @submit.prevent="startPasswordReset">
				<p class="text-sm text-muted-foreground">
					{{ $t("login-form.change-password.prompt") }}
				</p>
				<Field>
					<FieldLabel for="fp-email">{{ $t("login-form.email") }}</FieldLabel>
					<Input id="fp-email" v-model="email" :disabled="isLoading" />
				</Field>
				<Field>
					<FieldLabel for="fp-username">{{ $t("login-form.username") }}</FieldLabel>
					<Input id="fp-username" v-model="username" :disabled="isLoading" />
				</Field>
				<DialogFooter>
					<Button type="submit" :disabled="isLoading">
						<Spinner v-if="isLoading" class="size-4" />
						{{ $t("login-form.change-password.reset") }}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	</Dialog>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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

const emit = defineEmits(["password-reset"]);

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
				duration: 5000,
			});
			emit("password-reset");
		} else {
			toast.add({
				style: ToastStyle.Error,
				content: i18n.t("login-form.change-password.failed"),
				duration: 5000,
			});
		}
		// biome-ignore lint/correctness/noUnusedVariables: biome migration
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
