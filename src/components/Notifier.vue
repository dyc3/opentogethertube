<template>
	<v-snackbar app left :color="color" v-model="active">
		<v-icon v-if="icon">{{ icon }}</v-icon>
		{{ message }}
	</v-snackbar>
</template>

<script>
/**
 * Helper to allow easy popup notifications. Useful for providing visual feedback to the user.
 * Will listen to the global event bus for events on `notify_on${event}`
 *
 * TODO: show multiple notifications at a time
 * TODO: show a little progress bar for when the notification will go away
 * TODO: add options to set timeout for each message
 * FIXME: make sure that notifications from multiple notifiers don't cover each other up
 * */
export default {
	name: "Notifier",
	props: {
		event: { type: String, required: true },
		color: { type: String, default: "" },
		icon: { type: String, default: "" },
	},
	data() {
		return {
			active: false,
			message: "",
		};
	},
	created() {
		this.$events.on(`notify_on${this.event}`, this.onMessage);
	},
	destroyed() {
		this.$events.remove(`notify_on${this.event}`, this.onMessage);
	},
	methods: {
		onMessage({ message }) {
			this.message = message;
			this.active = true;
		},
	},
};
</script>
