<template>
	<v-snackbar
		app
		right
		absolute
		value="true"
		timeout="-1"
		:color="color"
		class="toast"
		transform="false"
	>
		<v-icon v-if="toast.style === ToastStyle.Success">fas fa-check</v-icon>
		<v-icon v-else-if="toast.style === ToastStyle.Error">fas fa-exclamation-circle</v-icon>
		{{ toast.content }}
		<div class="bar" :style="{ 'animation-duration': `${this.toast.duration}ms` }"></div>
		<template v-slot:action="{ attrs }">
			<v-btn text v-if="undoable" @click="undo">
				{{ $t("actions.undo") }}
			</v-btn>
			<v-btn text v-bind="attrs" @click="close" size="x-small" icon :color="`${color} darken-2`">
				<v-icon>fas fa-times</v-icon>
			</v-btn>
		</template>
	</v-snackbar>
</template>

<script lang="ts">
import { PropType } from "vue";
import {
	defineComponent,
	ref,
	toRefs,
	onMounted,
	onUnmounted,
	Ref,
	computed,
} from "vue";
import { Toast, ToastStyle } from "@/models/toast";
import { RoomRequestType } from "common/models/messages";
import { API } from "@/common-http";
import toasts from "@/util/toast";
import { useStore } from "vuex";

interface ToastNotificationProps {
	toast: Toast;
	number: number;
}

const ToastNotification = defineComponent({
	name: "ToastNotification",
	props: {
		toast: { type: Object as PropType<Toast> },
		number: { type: Number },
	},
	setup(props: ToastNotificationProps) {
		let { toast } = toRefs(props);
		const store = useStore();
		let padding = ref(8);
		let closeTimeoutId: Ref<ReturnType<typeof setTimeout> | null> = ref(null);

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

		let color = computed(() => {
			if (toast.value.style === ToastStyle.Success) {
				return "green";
			} else if (toast.value.style === ToastStyle.Error) {
				return "red";
			}
			return undefined;
		});

		let undoable = computed(() => {
			if (!toast.value.event) {
				return false;
			}
			let eventType = toast.value.event.request.type;
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

		return {
			padding,
			color,
			undoable,

			undo,
			close,
			ToastStyle,
		};
	},
});

export default ToastNotification;
</script>

<style lang="scss" scoped>
@keyframes toast_timer {
	0% {
		// transform: scaleX(1);
		width: 100%;
	}
	100% {
		// transform: scaleX(0);
		width: 0;
	}
}

.toast {
	position: relative;

	.bar {
		display: block;
		position: absolute;
		width: 100%;
		background: white;
		height: 4px;
		right: 0;
		bottom: 0;

		animation-name: toast_timer;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}
}
</style>
