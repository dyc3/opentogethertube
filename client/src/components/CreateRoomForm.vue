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
					persistent-hint
				/>
				<v-text-field
					:label="$t('create-room-form.title')"
					:hint="$t('create-room-form.title-hint')"
					v-model="options.title"
					persistent-hint
				/>
				<v-text-field
					:label="$t('create-room-form.description')"
					:hint="$t('create-room-form.description-hint')"
					v-model="options.description"
					persistent-hint
				/>
				<v-select
					:label="$t('create-room-form.visibility')"
					:hint="$t('create-room-form.visibility-hint')"
					:items="[
						{ title: $t('create-room-form.public'), value: 'public' },
						{ title: $t('create-room-form.unlisted'), value: 'unlisted' },
					]"
					v-model="options.visibility"
					:rules="rules.visibility"
					persistent-hint
				/>
				<v-select
					:label="$t('create-room-form.queue-mode')"
					:items="[
						{ title: $t('create-room-form.manual'), value: 'manual' },
						{ title: $t('create-room-form.vote'), value: 'vote' },
					]"
					v-model="options.queueMode"
					:rules="rules.queueMode"
					persistent-hint
				/>
				<div :key="error">{{ error }}</div>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn
					variant="text"
					@click="submit"
					role="Submit"
					:loading="isSubmitting"
					:disabled="!isValid"
					color="primary"
					>{{ $t("create-room-form.create-room") }}</v-btn
				>
				<v-btn variant="text" @click="$emit('cancel')">{{ $t("actions.cancel") }}</v-btn>
			</v-card-actions>
		</v-form>
	</v-card>
</template>

<script lang="ts">
import { defineComponent, reactive, Ref, ref, watch } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { ROOM_NAME_REGEX } from "common/constants";
import { Visibility, QueueMode } from "common/models/types";
import { useI18n } from "vue-i18n";
import { useStore } from "@/store";

export const CreateRoomForm = defineComponent({
	name: "CreateRoomForm",
	emits: ["roomCreated", "cancel"],
	setup(_props, { emit }) {
		const store = useStore();
		const { t } = useI18n();

		const options = reactive({
			name: "",
			title: "",
			description: "",
			visibility: Visibility.Public,
			queueMode: QueueMode.Manual,
		});

		const rules = {
			name: [
				(v: string) => !!v || t("create-room-form.rules.name.name-required"),
				(v: string) =>
					(v && !v.includes(" ")) || t("create-room-form.rules.name.no-spaces"),
				(v: string) =>
					(v && v.length >= 3 && v.length <= 32) ||
					t("create-room-form.rules.name.length"),
				(v: string) =>
					(v && ROOM_NAME_REGEX.test(v)) || t("create-room-form.rules.name.alphanumeric"),
				(v: string) =>
					(v && !isRoomNameTaken.value) || t("create-room-form.rules.name.taken"),
			],
			// eslint-disable-next-line array-bracket-newline
			visibility: [
				// eslint-disable-next-line array-bracket-newline
				(v: string) =>
					(v && [Visibility.Public, Visibility.Unlisted].includes(v as Visibility)) ||
					t("create-room-form.rules.invalid-visibility"),
			],
			// eslint-disable-next-line array-bracket-newline
			queueMode: [
				// eslint-disable-next-line array-bracket-newline
				(v: string) =>
					(v &&
						[QueueMode.Manual, QueueMode.Vote, QueueMode.Loop, QueueMode.Dj].includes(
							v as QueueMode
						)) ||
					t("create-room-form.rules.invalid-queue"),
			],
		};

		const isValid = ref(true);
		const isSubmitting = ref(false);
		const isRoomNameTaken = ref(false);
		const error = ref("");
		const form: Ref<{ validate(): void } | undefined> = ref();

		async function submit(e): Promise<void> {
			e.preventDefault();
			if (!form.value) {
				console.error("Form not found");
				return;
			}
			form.value.validate();
			if (!isValid.value) {
				return;
			}

			try {
				let opts = {
					...options,
					isTemporary: false,
				};
				await createRoomHelper(store, opts);
				console.info("Room created");
				emit("roomCreated", options.name);
				options.name = "";
				options.title = "";
				options.description = "";
				options.visibility = Visibility.Public;
				options.queueMode = QueueMode.Manual;
			} catch (err) {
				if (err.response) {
					if (err.response.status === 400) {
						if (err.response.data.error.name === "RoomNameTakenException") {
							isRoomNameTaken.value = true;
						}
						error.value = err.response.data.error.message;
					} else {
						error.value = t("create-room-form.unknown-error");
					}
				} else {
					error.value = err.message;
				}
				form.value.validate();
			}
		}

		watch(options, () => {
			isRoomNameTaken.value = false;
			error.value = "";
		});

		return {
			options,
			rules,
			isValid,
			isSubmitting,
			isRoomNameTaken,
			error,
			form,

			submit,
		};
	},
});

export default CreateRoomForm;
</script>

<style lang="scss" scoped></style>
