<template>
	<div>
		<div v-for="(toast, index) in $store.state.toast.notifications" :key="toast.id">
			<ToastNotification :toast="toast" :number="index"/>
		</div>
	</div>
</template>

<script lang="ts">
import { ToastStyle, Toast } from '@/models/toast';
import { VuexMutation } from "@/models/vuex";
import ToastNotification from "@/components/ToastNotification.vue";

/**
 * Handles displaying all toast notifications.
 *
 * TODO: show a little progress bar for when the notification will go away
 * TODO: add options to set timeout for each message
 * */
export default {
	name: "Notifier",
	components: {
		ToastNotification,
	},
	data() {
		return {
			ToastStyle,
		};
	},
	created() {
		this.$store.subscribe((mutation: VuexMutation<Toast>) => {
			if (mutation.type !== "ADD_TOAST") {
				return;
			}
			console.log(mutation);
			this.$forceUpdate();
		});
		this.$store.commit("toast/ADD_TOAST", {
			style: ToastStyle.Neutral,
			content: "test",
		});
		this.$store.commit("toast/ADD_TOAST", {
			style: ToastStyle.Error,
			content: "test error",
		});
		this.$store.commit("toast/ADD_TOAST", {
			style: ToastStyle.Success,
			content: "test success",
		});
	},
	methods: {

	},
};
</script>

<style lang="scss" scoped>
@keyframes toast-timer {
	0% {
		transform: scaleX(100);
	}
	100% {
		transform: scaleX(0);
	}
}
</style>
