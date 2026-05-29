<template>
	<Card class="border-line-strong">
		<form @submit.prevent="submit">
			<CardHeader>
				<CardTitle class="text-2xl tracking-wide">
					{{ $t("create-room-form.card-title") }}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field :data-invalid="showNameError || undefined">
						<FieldLabel for="crf-name">{{ $t("create-room-form.name") }}</FieldLabel>
						<Input
							id="crf-name"
							v-model="options.name"
							maxlength="32"
							:aria-invalid="showNameError || undefined"
							@keydown="() => (isRoomNameTaken = false)"
							@blur="touched.name = true"
						/>
						<div class="flex justify-between gap-2">
							<FieldDescription>{{ $t("create-room-form.name-hint") }}</FieldDescription>
							<span class="text-xs text-dim font-mono">{{ options.name.length }}/32</span>
						</div>
						<FieldError v-if="showNameError">{{ errors.name }}</FieldError>
					</Field>

					<button
						type="button"
						class="flex w-full items-center justify-between rounded-md border border-line bg-surface-2/40 px-3 py-2 font-mono text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
						:aria-expanded="showSettings"
						@click="showSettings = !showSettings"
					>
						<span>{{ $t("room.tabs.settings") }}</span>
						<Icon
							:icon="mdiChevronDown"
							class="size-4 transition-transform duration-200"
							:class="{ 'rotate-180': showSettings }"
						/>
					</button>

					<Transition name="ott-expand">
						<div v-if="showSettings" class="flex flex-col gap-5 overflow-hidden">
							<Field>
								<FieldLabel for="crf-title">{{ $t("create-room-form.title") }}</FieldLabel>
								<Input id="crf-title" v-model="options.title" />
								<FieldDescription>{{ $t("create-room-form.title-hint") }}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel for="crf-desc">{{ $t("create-room-form.description") }}</FieldLabel>
								<Input id="crf-desc" v-model="options.description" />
								<FieldDescription>
									{{ $t("create-room-form.description-hint") }}
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>{{ $t("create-room-form.visibility") }}</FieldLabel>
								<Select v-model="options.visibility">
									<SelectTrigger class="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="public">{{ $t("create-room-form.public") }}</SelectItem>
										<SelectItem value="unlisted">
											{{ $t("create-room-form.unlisted") }}
										</SelectItem>
									</SelectContent>
								</Select>
								<FieldDescription>{{ $t("create-room-form.visibility-hint") }}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>{{ $t("create-room-form.queue-mode") }}</FieldLabel>
								<Select v-model="options.queueMode">
									<SelectTrigger class="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="manual">{{ $t("create-room-form.manual") }}</SelectItem>
										<SelectItem value="vote">{{ $t("create-room-form.vote") }}</SelectItem>
										<SelectItem value="loop">{{ $t("create-room-form.loop") }}</SelectItem>
										<SelectItem value="dj">{{ $t("create-room-form.dj") }}</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</div>
					</Transition>

					<p v-if="error" :key="error" class="text-sm text-destructive">{{ error }}</p>
				</FieldGroup>
			</CardContent>
			<CardFooter class="justify-end gap-2">
				<Button variant="ghost" type="button" @click="$emit('cancel')">
					{{ $t("common.cancel") }}
				</Button>
				<Button type="submit" role="Submit" :disabled="!isValid || isSubmitting">
					<Spinner v-if="isSubmitting" class="size-4" />
					{{ $t("create-room-form.create-room") }}
				</Button>
			</CardFooter>
		</form>
	</Card>
</template>

<script lang="ts" setup>
import { mdiChevronDown } from "@mdi/js";
import { computed, reactive, ref, watch } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { ROOM_NAME_REGEX } from "ott-common/constants";
import { Visibility, QueueMode } from "ott-common/models/types";
import { useI18n } from "vue-i18n";
import { useStore } from "@/store";

const emit = defineEmits(["roomCreated", "cancel"]);

const store = useStore();
const { t } = useI18n();

const options = reactive({
	name: "",
	title: "",
	description: "",
	visibility: Visibility.Public,
	queueMode: QueueMode.Manual,
});

const isSubmitting = ref(false);
const isRoomNameTaken = ref(false);
const error = ref("");
const showSettings = ref(false);
const touched = reactive({ name: false });

const errors = computed(() => {
	const v = options.name;
	let name = "";
	if (!v) {
		name = t("create-room-form.rules.name.name-required");
	} else if (v.includes(" ")) {
		name = t("create-room-form.rules.name.no-spaces");
	} else if (v.length < 3 || v.length > 32) {
		name = t("create-room-form.rules.name.length");
	} else if (!ROOM_NAME_REGEX.test(v)) {
		name = t("create-room-form.rules.name.alphanumeric");
	} else if (isRoomNameTaken.value) {
		name = t("create-room-form.rules.name.taken");
	}
	return { name };
});

const isValid = computed(() => !errors.value.name);
const showNameError = computed(() => touched.name && !!errors.value.name);

async function submit(): Promise<void> {
	touched.name = true;
	if (!isValid.value) {
		return;
	}
	isSubmitting.value = true;
	try {
		const opts = {
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
	} finally {
		isSubmitting.value = false;
	}
}

watch(options, () => {
	isRoomNameTaken.value = false;
	error.value = "";
});
</script>

<style scoped>
.ott-expand-enter-active,
.ott-expand-leave-active {
	transition: all 0.25s ease;
	max-height: 600px;
}
.ott-expand-enter-from,
.ott-expand-leave-to {
	max-height: 0;
	opacity: 0;
}
</style>
