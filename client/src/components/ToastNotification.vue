<template>
	<div class="toast bg-card border border-line rounded text-foreground" aria-live="polite">
		<Icon v-if="!!icon" :icon="icon" class="ml-3 size-5 shrink-0" :class="colorClass" />
		<span class="toast-content">
			<ProcessedText :text="toast.content" :show-add-queue-tooltip="false" />
		</span>
		<div class="bar" :class="barClass" :style="{ 'animation-duration': `${toast.duration}ms` }" />
		<div class="ml-auto flex items-center">
			<Button variant="ghost" size="sm" v-if="undoable" @click="undo">
				{{ $t("common.undo") }}
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				@click="close"
				:aria-label="$t('common.close')"
			>
				<Icon :icon="mdiClose" class="size-4" />
			</Button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { mdiClose, mdiCheckBold, mdiAlertCircle } from "@mdi/js";
import { ref, toRefs, onMounted, onUnmounted, type Ref, computed } from "vue";
import { type Toast, ToastStyle } from "@/models/toast";
import { RoomRequestType } from "ott-common/models/messages";
import { API } from "@/common-http";
import toasts from "@/util/toast";
import { useStore } from "@/store";
import ProcessedText from "./ProcessedText.vue";

const props = defineProps<{ toast: Toast; number?: number }>();

const { toast } = toRefs(props);
const store = useStore();
const closeTimeoutId: Ref<ReturnType<typeof setTimeout> | null> = ref(null);

onMounted(() => {
	if (toast.value.duration) {
		closeTimeoutId.value = setTimeout(() => {
			close();
		}, toast.value.duration);
	}
});

onUnmounted(() => {
	if (closeTimeoutId.value) {
		clearTimeout(closeTimeoutId.value);
	}
});

const colorClass = computed(() => {
	if (toast.value.style === ToastStyle.Success) {
		return "text-success";
	} else if (toast.value.style === ToastStyle.Error) {
		return "text-destructive";
	} else if (toast.value.style === ToastStyle.Important) {
		return "text-warning";
	}
	return "text-signal";
});

const barClass = computed(() => {
	if (toast.value.style === ToastStyle.Success) {
		return "bg-success";
	} else if (toast.value.style === ToastStyle.Error) {
		return "bg-destructive";
	} else if (toast.value.style === ToastStyle.Important) {
		return "bg-warning";
	}
	return "bg-signal";
});

const icon = computed(() => {
	if (toast.value.style === ToastStyle.Success) {
		return mdiCheckBold;
	} else if (toast.value.style === ToastStyle.Error) {
		return mdiAlertCircle;
	}
	return undefined;
});

const undoable = computed(() => {
	if (!toast.value.event) {
		return false;
	}
	const eventType = toast.value.event.request.type;
	return (
		eventType === RoomRequestType.SeekRequest ||
		eventType === RoomRequestType.SkipRequest ||
		eventType === RoomRequestType.AddRequest ||
		eventType === RoomRequestType.RemoveRequest
	);
});

async function undo() {
	try {
		await API.post(`/room/${store.state.room.name}/undo`, {
			data: { event: toast.value.event },
		});
		close();
	} catch (err) {
		toasts.add({
			style: ToastStyle.Error,
			content: err.message,
			duration: 4000,
		});
	}
}

function close() {
	toasts.remove(toast.value.id);
}
</script>

<style scoped>
@keyframes toast_timer {
	0% {
		width: 100%;
	}
	100% {
		width: 0;
	}
}

.toast {
	position: relative;
	display: inline-flex;
	min-height: 48px;
	margin: 8px;
	padding: 0;
	min-width: 344px;
	max-width: 672px;
	align-items: center;
	box-shadow: var(--shadow-panel);
}

.toast-content {
	padding: 14px 16px;
}

.bar {
	display: block;
	position: absolute;
	width: 100%;
	height: 3px;
	right: 0;
	bottom: 0;

	animation-name: toast_timer;
	animation-timing-function: linear;
	animation-fill-mode: forwards;
}
</style>
