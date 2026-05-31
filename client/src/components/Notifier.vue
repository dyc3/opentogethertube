<template>
	<transition-group appear name="toast-list" tag="div" class="toast-list">
		<div v-for="(t, index) in store.state.toast.notifications" :key="t.id" class="toast-item">
			<ToastNotification :toast="t" :number="index" />
		</div>
		<Button
			variant="default"
			class="close-all w-full"
			key="closeall"
			@click="closeAll"
			v-if="store.state.toast.notifications.length > 1"
			data-cy="toast-close-all"
		>
			{{ $t("common.close-all") }}
		</Button>
	</transition-group>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import ToastNotification from "@/components/ToastNotification.vue";
import { useStore } from "@/store";
import toast from "@/util/toast";

const store = useStore();
toast.setStore(store);

function closeAll() {
	store.commit("toast/CLEAR_ALL_TOASTS");
}
</script>

<style scoped>
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
}

.toast-list :deep(.toast),
.toast-list .close-all {
	pointer-events: auto;
}

.close-all {
	margin: 0 8px 8px;
	max-width: 672px;
}

/* define the animations for individual toasts */
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
}
</style>
