<template>
	<v-snackbar
		app left
		value="true"
		timeout="-1"
		:color="color"
		:style="{
			bottom: `${toastHeight * number}px`
		}"
	>
		<v-icon v-if="toast.style === ToastStyle.Success">fas fa-check</v-icon>
		<v-icon v-else-if="toast.style === ToastStyle.Error">fas fa-exclamation-circle</v-icon>
		{{ toast.content }}
	</v-snackbar>
</template>

<script lang="ts">
import { Toast, ToastStyle } from '@/models/toast';
import style from "@/styleProxy";

export default {
	name: "Toast",
	props: {
		toast: {
			type: Object as () => Toast,
		},
		number: {
			type: Number,
		},
	},
	data(): { ToastStyle: typeof ToastStyle; padding: number } {
		return {
			ToastStyle,
			padding: 8,
		};
	},
	computed: {
		color(): string | undefined {
			if (this.toast.style === ToastStyle.Success) {
				return "green";
			}
			else if (this.toast.style === ToastStyle.Error) {
				return "red";
			}
			return undefined;
		},
		toastHeight(): number {
			return style.toast.height + style.toast.padding + style.toast.margin + this.padding;
		},
	},
};
</script>

<style>

</style>
