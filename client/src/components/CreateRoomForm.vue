<template>
	<v-card>
		<v-form ref="form" @submit="submit" v-model="isValid">
			<v-card-title>{{ $t("create-room-form.card-title") }}</v-card-title>
			<v-card-text>
				<v-text-field
					:label="$t('create-room-form.name')"
					:hint="$t('create-room-form.name-hint')"
					v-model="options.name"
					required
					counter="32"
					:rules="rules.name"
					@keydown="() => (isRoomNameTaken = false)"
				/>
				<v-text-field
					:label="$t('create-room-form.title')"
					:hint="$t('create-room-form.title-hint')"
					v-model="options.title"
				/>
				<v-text-field
					:label="$t('create-room-form.description')"
					:hint="$t('create-room-form.description-hint')"
					v-model="options.description"
				/>
				<v-select
					:label="$t('create-room-form.visibility')"
					:hint="$t('create-room-form.visibility-hint')"
					:items="[
						{ text: $t('create-room-form.public'), value: 'public' },
						{ text: $t('create-room-form.unlisted'), value: 'unlisted' },
					]"
					v-model="options.visibility"
					:rules="rules.visibility"
				/>
				<v-select
					:label="$t('create-room-form.queue-mode')"
					:items="[
						{ text: $t('create-room-form.manual'), value: 'manual' },
						{ text: $t('create-room-form.vote'), value: 'vote' },
					]"
					v-model="options.queueMode"
					:rules="rules.queueMode"
				/>
				<div :key="error">{{ error }}</div>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn
					text
					@click="submit"
					role="Submit"
					:loading="isSubmitting"
					:disabled="!isValid"
					color="primary"
					>{{ $t("create-room-form.create-room") }}</v-btn
				>
				<v-btn text @click="$emit('cancel')">{{ $t("actions.cancel") }}</v-btn>
			</v-card-actions>
		</v-form>
	</v-card>
</template>

<script>
import { createRoomHelper } from "@/util/roomcreator";
import { ROOM_NAME_REGEX } from "common/constants";

export default {
	name: "CreateRoomForm",
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
					v => !!v || this.$t("create-room-form.rules.name.name-required"),
					v =>
						(v && !v.includes(" ")) || this.$t("create-room-form.rules.name.no-spaces"),
					v =>
						(v && v.length >= 3 && v.length <= 32) ||
						this.$t("create-room-form.rules.name.length"),
					v =>
						(v && ROOM_NAME_REGEX.test(v)) ||
						this.$t("create-room-form.rules.name.alphanumeric"),
					v =>
						(v && !this.isRoomNameTaken) ||
						this.$t("create-room-form.rules.name.taken"),
				],
				// eslint-disable-next-line array-bracket-newline
				visibility: [
					// eslint-disable-next-line array-bracket-newline
					v =>
						(v && ["public", "unlisted"].includes(v)) ||
						this.$t("create-room-form.rules.invalid-visibility"),
				],
				// eslint-disable-next-line array-bracket-newline
				queueMode: [
					// eslint-disable-next-line array-bracket-newline
					v =>
						(v && ["manual", "vote"].includes(v)) ||
						this.$t("create-room-form.rules.invalid-queue"),
				],
			},

			isValid: false,
			isSubmitting: false,
			isRoomNameTaken: false,
			error: "",
		};
	},
	methods: {
		async submit(e) {
			e.preventDefault();
			this.$refs.form.validate();
			if (!this.isValid) {
				return;
			}

			try {
				let opts = {
					...this.options,
					isTemporary: false,
				};
				await createRoomHelper(this.$store, opts);
				console.info("Room created");
				this.$emit("roomCreated", this.options.name);
				this.options = {
					name: "",
					title: "",
					description: "",
					visibility: "public",
					queueMode: "manual",
				};
			} catch (err) {
				if (err.response) {
					if (err.response.status === 400) {
						if (err.response.data.error.name === "RoomNameTakenException") {
							this.isRoomNameTaken = true;
						}
						this.error = err.response.data.error.message;
					} else {
						this.error = this.$t("create-room-form.unknown-error");
					}
				} else {
					this.error = err.message;
				}
				this.$refs.form.validate();
			}
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

<style lang="scss" scoped></style>
