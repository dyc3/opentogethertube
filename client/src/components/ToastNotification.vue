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
			<v-btn text v-bind="attrs" @click="close" x-small icon :color="`${color} darken-2`">
				<v-icon>fas fa-times</v-icon>
			</v-btn>
		</template>
	</v-snackbar>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";
import { Toast, ToastStyle } from "@/models/toast";
import { RoomRequestType } from "common/models/messages";
import Component from "vue-class-component";
import { API } from "@/common-http";

@Component({
	name: "ToastNotification",
	props: {
		toast: {
			type: Object as PropType<Toast>,
		},
		number: {
			type: Number,
		},
	},
})
export default class ToastNotification extends Vue {
	toast: Toast;
	number: number;

	padding = 8;
	closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
	ToastStyle = ToastStyle;

	get color(): string | undefined {
		if (this.toast.style === ToastStyle.Success) {
			return "green";
		} else if (this.toast.style === ToastStyle.Error) {
			return "red";
		}
		return undefined;
	}

	get undoable(): boolean {
		if (!this.toast.event) {
			return false;
		}
		let eventType = this.toast.event.request.type;
		return (
			eventType === RoomRequestType.SeekRequest ||
			eventType === RoomRequestType.SkipRequest ||
			eventType === RoomRequestType.AddRequest ||
			eventType === RoomRequestType.RemoveRequest
		);
	}

	created(): void {
		if (this.toast.duration) {
			this.closeTimeoutId = setTimeout(() => {
				this.close();
			}, this.toast.duration);
		}
	}

	destroyed() {
		if (this.closeTimeoutId) {
			clearTimeout(this.closeTimeoutId);
		}
	}

	close() {
		this.$toast.remove(this.toast.id);
	}

	async undo() {
		try {
			await API.post(`/room/${this.$route.params.roomId}/undo`, {
				data: { event: this.toast.event },
			});
			this.close();
		} catch (err) {
			this.$toast.add({
				style: ToastStyle.Error,
				content: err.message,
				duration: 4000,
			});
		}
	}
}
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
