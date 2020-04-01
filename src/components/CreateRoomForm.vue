<template>
	<v-card>
		<v-form ref="form" @submit="submit" v-model="isValid">
			<v-card-title>Create a Permanent Room</v-card-title>
			<v-card-text>
				<v-text-field label="Name" hint="Used in the room URL. Can't be changed later." v-model="name" required counter="32" :rules="nameRules" @keydown="() => isRoomNameTaken = false" />
				<v-text-field label="Title" hint="Optional" v-model="title" />
				<v-text-field label="Description" hint="Optional" v-model="description" />
				<v-select label="Visibility" hint="Controls whether or not the room shows up in the room list." :items="[{ text: 'public' }, { text: 'unlisted' }]" v-model="visibility" />
				<v-select label="Queue Mode" :items="[{ text: 'manual' }, { text: 'vote' }]" v-model="queueMode" />
				<div :key="error">{{ error }}</div>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn text @click="submit" role="Submit" :loading="isSubmitting" :disabled="!isValid" color="primary">Create Room</v-btn>
				<v-btn text @click="$emit('cancel')">Cancel</v-btn>
			</v-card-actions>
		</v-form>
	</v-card>
</template>

<script>
import { API } from "@/common-http.js";

export default {
	name: "CreateRoomForm",
	data() {
		return {
			name: "",
			nameRules: [
				v => !!v || "Name is required",
				v => (v && v.length >= 3 && v.length <= 32) || "Name must be between 3 and 32 characters",
				v => (v && !this.isRoomNameTaken) || "Name is already taken",
			],
			title: "",
			description: "",
			visibility: "public",
			// eslint-disable-next-line array-bracket-newline
			visibilityRules: [
				// eslint-disable-next-line array-bracket-newline
				v => (v && ["public", "unlisted"].includes(v)) || "Invalid Visibility",
			],
			queueMode: "manual",
			// eslint-disable-next-line array-bracket-newline
			queueModeRules: [
				// eslint-disable-next-line array-bracket-newline
				v => (v && ["manual", "vote"].includes(v)) || "Invalid Queue Mode",
			],

			isValid: false,
			isSubmitting: false,
			isRoomNameTaken: false,
			error: "",
		};
	},
	methods: {
		submit() {
			this.$refs.form.validate();
			if (!this.isValid) {
				return;
			}

			this.isSubmitting = true;
			API.post(`/room/create`, {
				name: this.name,
				temporary: false,
				title: this.title,
				description: this.description,
				visibility: this.visibility,
				queueMode: this.queueMode,
			}).then(() => {
				this.isSubmitting = false;
				this.$emit("roomCreated", this.name);
			}).catch(err => {
				this.isSubmitting = false;
				if (err.response) {
					if (err.response.status === 400) {
						if (err.response.data.error.name === "RoomNameTakenException") {
							this.isRoomNameTaken = true;
						}
						this.error = err.response.data.error.message;
					}
					else {
						this.error = "An unknown error occurred. Try again later.";
					}
				}
				else {
					this.error = err.message;
				}
				this.$refs.form.validate();
			});
		},
	},
	watch: {
		name() {
			this.isRoomNameTaken = false;
			this.error = "";
		},
	},
};
</script>

<style lang="scss" scoped>

</style>
