<template>
	<transition-group appear name="toast-list" tag="ul" class="toast-list">
		<li v-for="(toast, index) in $store.state.toast.notifications" :key="toast.id" class="toast-item">
			<ToastNotification :toast="toast" :number="index"/>
		</li>
	</transition-group>
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

.toast-list {
	display: block;
	position: fixed;
	padding: 0;
	bottom: 0;
}

li {
	list-style-type: none;
}

// define the animations for individual toasts
.toast-list-move {
	transition: all .25s ease;
}

.toast-list-enter-active, .toast-list-leave-active {
	transition: all .25s;
}
.toast-list-enter, .toast-list-leave-to {
	opacity: 0;
	transform: translateY(50px);
	// bottom: -50px;
}
</style>
