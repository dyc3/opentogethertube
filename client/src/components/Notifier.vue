<template>
	<transition-group appear name="toast-list" tag="div" class="toast-list">
		<div v-for="(t, index) in store.state.toast.notifications" :key="t.id" class="toast-item">
			<ToastNotification :toast="t" :number="index" />
		</div>
		<v-btn
			block
			color="primary"
			key="closeall"
			@click="closeAll"
			v-if="store.state.toast.notifications.length > 1"
			data-cy="toast-close-all"
		>
			{{ $t("common.close-all") }}
		</v-btn>
	</transition-group>
</template>

<script lang="ts" setup>
import ToastNotification from "@/components/ToastNotification.vue";
import { useStore } from "@/store";
import toast from "@/util/toast";

const store = useStore();
toast.setStore(store);

function closeAll() {
	store.commit("toast/CLEAR_ALL_TOASTS");
}
</script>

<style lang="scss" scoped>
.toast-list {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	position: fixed;
	padding: 0;
	bottom: 0;
	right: 0;
	pointer-events: none;
	z-index: 1000;

	.toast,
	button {
		pointer-events: auto;
	}
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
