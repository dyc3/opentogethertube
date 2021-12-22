<template>
	<v-card>
		<v-form ref="form" @submit="submit" v-model="isValid">
			<v-card-title>Create a Permanent Room</v-card-title>
			<v-card-text>
				<v-text-field label="Name" hint="Used in the room URL. Can't be changed later." v-model="options.name" required counter="32" :rules="rules.name" @keydown="() => isRoomNameTaken = false" />
				<v-text-field label="Title" hint="Optional" v-model="options.title" />
				<v-text-field label="Description" hint="Optional" v-model="options.description" />
				<v-select label="Visibility" hint="Controls whether or not the room shows up in the room list." :items="[{ text: 'public' }, { text: 'unlisted' }]" v-model="options.visibility" :rules="rules.visibility" />
				<v-select label="Queue Mode" :items="[{ text: 'manual' }, { text: 'vote' }]" v-model="options.queueMode" :rules="rules.queueMode" />
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
import RoomUtilsMixin from "@/mixins/RoomUtils.js";
import { ROOM_NAME_REGEX } from "common/constants";

export default {
	name: "CreateRoomForm",
	mixins: [RoomUtilsMixin],
	data() {
		return {
			options: {
				name: "",
				title: "",
				description: "",
				visibility: "public",
				queueMode: "manual",
			},
			rules: {
				name: [
					v => !!v || "Name is required",
					v => (v && !v.includes(" ")) || "Name must not contain spaces.",
					v => (v && v.length >= 3 && v.length <= 32) || "Name must be between 3 and 32 characters",
					v => (v && ROOM_NAME_REGEX.test(v)) || "Name must only contain alphanumeric characters, dashes, and underscores",
					v => (v && !this.isRoomNameTaken) || "Name is already taken",
				],
				// eslint-disable-next-line array-bracket-newline
				visibility: [
					// eslint-disable-next-line array-bracket-newline
					v => (v && ["public", "unlisted"].includes(v)) || "Invalid Visibility",
				],
				// eslint-disable-next-line array-bracket-newline
				queueMode: [
					// eslint-disable-next-line array-bracket-newline
					v => (v && ["manual", "vote"].includes(v)) || "Invalid Queue Mode",
				],
			},

			isValid: false,
			isSubmitting: false,
			isRoomNameTaken: false,
			error: "",
		};
	},
	methods: {
		submit(e) {
			e.preventDefault();
			this.$refs.form.validate();
			if (!this.isValid) {
				return;
			}

			this.createPermRoom(this.options).then(() => {
				this.$emit("roomCreated", this.options.name);
				this.options = {
					name: "",
					title: "",
					description: "",
					visibility: "public",
					queueMode: "manual",
				};
			}).catch(err => {
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
