<template>
	<transition-group appear name="toast-list" tag="ul" class="toast-list">
		<li
			v-for="(toast, index) in $store.state.toast.notifications"
			:key="toast.id"
			class="toast-item"
		>
			<ToastNotification :toast="toast" :number="index" />
		</li>
		<v-btn
			block
			color="primary"
			key="closeall"
			@click="closeAll"
			v-if="$store.state.toast.notifications.length > 1"
		>
			{{ $t("actions.close-all") }}
		</v-btn>
	</transition-group>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";
import ToastNotification from "@/components/ToastNotification.vue";

/**
 * Handles displaying all toast notifications.
 */
@Component({
	name: "Notifier",
	components: {
		ToastNotification,
	},
})
export default class Notifier extends Vue {
	closeAll() {
		this.$store.commit("toast/CLEAR_ALL_TOASTS");
	}
}
</script>

<style lang="scss" scoped>
.toast-list {
	display: block;
	position: fixed;
	padding: 0;
	bottom: 0;
	right: 0;
	pointer-events: none;
	z-index: 1000;

	.v-stackbar,
	button {
		pointer-events: auto;
	}
}

li {
	list-style-type: none;
}

// define the animations for individual toasts
.toast-list-move {
	transition: all 0.25s ease;
}

.toast-list-enter-active,
.toast-list-leave-active {
	transition: all 0.25s;
}
.toast-list-enter,
.toast-list-leave-to {
	opacity: 0;
	transform: translateY(50px);
	// bottom: -50px;
}
</style>
