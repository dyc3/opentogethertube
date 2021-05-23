<template>
	<div>
		<div v-for="(toast, index) in $store.state.toast.notifications" :key="toast.id">
			<transition appear name="toast">
				<ToastNotification :toast="toast" :number="index"/>
			</transition>
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
	created(): void {
		this.$store.subscribe((mutation: VuexMutation<Toast>) => {
			if (mutation.type !== "ADD_TOAST") {
				return;
			}
		});
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

.toast-enter-active, .toast-leave-active {
	transition-property: all;
	transition-duration: .25s;
}
.toast-enter, .toast-leave-to {
	opacity: 0;
	bottom: -50px;
}
</style>
