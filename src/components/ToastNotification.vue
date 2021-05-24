<template>
	<v-snackbar
		app left
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
		<div class="bar" :style="{'animation-duration': `${this.toast.duration}ms`}"></div>
		<template v-slot:action="{ attrs }">
			<v-btn
				text
				v-bind="attrs"
				@click="close"
				x-small
				icon
				:color="`${color} darken-2`"
			>
				<v-icon>fas fa-times</v-icon>
			</v-btn>
		</template>
	</v-snackbar>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';
import { Toast, ToastStyle } from '@/models/toast';

export default Vue.extend({
	name: "Toast",
	props: {
		toast: {
			type: Object as PropType<Toast>,
		},
		number: {
			type: Number,
		},
	},
	data(): { ToastStyle: typeof ToastStyle; padding: number; closeTimeoutId: number | null } {
		return {
			ToastStyle,
			padding: 8,
			closeTimeoutId: null,
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
	},
	created(): void {
		if (this.toast.duration) {
			this.closeTimeoutId = setTimeout(() => {
				this.close();
			}, this.toast.duration);
		}
	},
	methods: {
		close() {
			this.$toast.remove(this.toast.id);
		},
	},
	destroyed() {
		clearTimeout(this.closeTimeoutId);
	},
});
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
		left: 0;
		bottom: 0;

		animation-name: toast_timer;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}
}

</style>
