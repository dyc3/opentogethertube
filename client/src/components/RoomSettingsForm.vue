<template>
	<div class="room-settings">
		<form @submit.prevent="submitRoomSettings">
			<FieldGroup>
				<Field>
					<FieldLabel for="rs-title">{{ $t("room-settings.title") }}</FieldLabel>
					<Input
						id="rs-title"
						v-model="settings.title.value"
						:disabled="!granted('configure-room.set-title')"
						data-cy="input-title"
					/>
				</Field>
				<Field>
					<FieldLabel for="rs-description">{{ $t("room-settings.description") }}</FieldLabel>
					<Input
						id="rs-description"
						v-model="settings.description.value"
						:disabled="!granted('configure-room.set-description')"
						data-cy="input-description"
					/>
				</Field>
				<Field>
					<FieldLabel>{{ $t("room-settings.visibility") }}</FieldLabel>
					<Select
						v-model="settings.visibility.value"
						v-model:open="visibilityMenuOpen"
						:disabled="!granted('configure-room.set-visibility')"
					>
						<SelectTrigger class="w-full" data-cy="select-visibility">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem :value="Visibility.Public">
								{{ $t("room-settings.public") }}
							</SelectItem>
							<SelectItem :value="Visibility.Unlisted">
								{{ $t("room-settings.unlisted") }}
							</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel>{{ $t("room-settings.queue-mode") }}</FieldLabel>
					<Select
						v-model="settings.queueMode.value"
						:disabled="!granted('configure-room.set-queue-mode')"
					>
						<SelectTrigger class="w-full" data-cy="select-queueMode">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem :value="QueueMode.Manual">
								<div class="flex flex-col">
									<span>{{ $t("room-settings.manual") }}</span>
									<span class="text-xs text-muted-foreground">
										{{ $t("room-settings.manual-hint") }}
									</span>
								</div>
							</SelectItem>
							<SelectItem :value="QueueMode.Vote">
								<div class="flex flex-col">
									<span>{{ $t("room-settings.vote") }}</span>
									<span class="text-xs text-muted-foreground">
										{{ $t("room-settings.vote-hint") }}
									</span>
								</div>
							</SelectItem>
							<SelectItem :value="QueueMode.Loop">
								<div class="flex flex-col">
									<span>{{ $t("room-settings.loop") }}</span>
									<span class="text-xs text-muted-foreground">
										{{ $t("room-settings.loop-hint") }}
									</span>
								</div>
							</SelectItem>
							<SelectItem :value="QueueMode.Dj">
								<div class="flex flex-col">
									<span>{{ $t("room-settings.dj") }}</span>
									<span class="text-xs text-muted-foreground">
										{{ $t("room-settings.dj-hint") }}
									</span>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<AutoSkipSegmentSettings
					:loading="
						isLoadingRoomSettings || dirtySettings.includes('autoSkipSegmentCategories')
					"
					:disabled="!granted('configure-room.other')"
					v-model="settings.autoSkipSegmentCategories.value"
				/>
				<Field>
					<FieldLabel>{{ $t("room-settings.restore-queue") }}</FieldLabel>
					<Select
						v-model="settings.restoreQueueBehavior.value"
						:disabled="!granted('configure-room.other')"
					>
						<SelectTrigger class="w-full" data-cy="select-restore-queue">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem :value="BehaviorOption.Always">
								{{ $t(`behavior.${BehaviorOption.Always}`) }}
							</SelectItem>
							<SelectItem :value="BehaviorOption.Prompt">
								{{ $t(`behavior.${BehaviorOption.Prompt}`) }}
							</SelectItem>
							<SelectItem :value="BehaviorOption.Never">
								{{ $t(`behavior.${BehaviorOption.Never}`) }}
							</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<div class="flex items-center gap-2">
					<Checkbox
						id="rs-vote-skip"
						v-model="settings.enableVoteSkip.value"
						:disabled="!granted('configure-room.other')"
						data-cy="input-vote-skip"
					/>
					<Label for="rs-vote-skip" class="cursor-pointer">
						{{ $t("room-settings.enable-vote-skip") }}
					</Label>
				</div>
				<PermissionsEditor
					v-if="store.state.user && store.state.room.hasOwner"
					v-model="settings.grants.value as Grants"
					:current-role="store.getters['users/self']?.role ?? Role.Owner"
				/>
				<p v-else-if="!store.state.room.hasOwner" class="text-sm text-muted-foreground">
					{{ $t("room-settings.room-needs-owner") }}
					<span v-if="!store.state.user">
						{{ $t("room-settings.login-to-claim") }}
					</span>
				</p>
				<p v-else class="text-sm text-muted-foreground">
					{{ $t("room-settings.arent-able-to-modify-permissions") }}
				</p>
			</FieldGroup>
			<div class="submit flex flex-col gap-3 pt-4">
				<Button
					v-if="!store.state.room.hasOwner"
					variant="signal"
					size="lg"
					class="w-full"
					type="button"
					:disabled="!store.state.user"
					role="submit"
					data-cy="claim"
					@click="claimOwnership"
				>
					Claim Room
				</Button>
				<Button
					size="xl"
					class="w-full"
					type="submit"
					role="submit"
					:disabled="dirtySettings.length === 0 || isLoadingRoomSettings"
					data-cy="save"
				>
					<Spinner v-if="isLoadingRoomSettings" class="size-4" />
					{{ $t("common.save") }}
				</Button>
			</div>
		</form>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import _ from "lodash";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { ToastStyle } from "@/models/toast";
import { API } from "@/common-http";
import {
	Visibility,
	QueueMode,
	type RoomSettings,
	Role,
	BehaviorOption,
} from "ott-common/models/types";
import { Grants } from "ott-common/permissions";
import toast from "@/util/toast";
import { type Ref, onMounted, reactive, ref, toRefs } from "vue";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import type { OttApiResponseGetRoom } from "ott-common/models/rest-api";
import { useGrants } from "./composables/grants";
import { useRoute } from "vue-router";
import { watch } from "vue";
import { watchDebounced } from "@vueuse/core";
import AutoSkipSegmentSettings from "./AutoSkipSegmentSettings.vue";

const store = useStore();
const { t } = useI18n();
const granted = useGrants();
const route = useRoute();

const isLoadingRoomSettings = ref(false);
const visibilityMenuOpen = ref(false);

function openVisibilityMenu() {
	visibilityMenuOpen.value = true;
}

const inputRoomSettings = reactive<RoomSettings>({
	title: "",
	description: "",
	visibility: Visibility.Public,
	queueMode: QueueMode.Manual,
	grants: new Grants(),
	autoSkipSegmentCategories: Array.from([]),
	restoreQueueBehavior: BehaviorOption.Prompt,
	enableVoteSkip: false,
});

const settings = toRefs(inputRoomSettings);
const dirtySettings: Ref<(keyof RoomSettings)[]> = ref([]);
for (const key of Object.keys(inputRoomSettings) as (keyof RoomSettings)[]) {
	watch(settings[key], () => {
		if (!dirtySettings.value.includes(key)) {
			dirtySettings.value.push(key);
		}
	});
}
watchDebounced(
	inputRoomSettings,
	async () => {
		if (dirtySettings.value.length === 0) {
			return;
		}
		await submitRoomSettings();
	},
	{ debounce: 1000 },
);

onMounted(async () => {
	await loadRoomSettings();
});

function intoSettings(obj: OttApiResponseGetRoom): RoomSettings {
	return {
		..._.omit(obj, ["name", "isTemporary", "users", "queue", "hasOwner", "grants"]),
		grants: new Grants(obj.grants),
	};
}

async function loadRoomSettings() {
	// we have to make an API request because visibility is not sent in sync messages.
	isLoadingRoomSettings.value = true;
	try {
		const res = await API.get<OttApiResponseGetRoom>(
			`/room/${route.params.roomId ?? store.state.room.name}`,
		);
		Object.assign(inputRoomSettings, intoSettings(res.data));
		setTimeout(() => {
			dirtySettings.value = [];
		}, 0);
	} catch (err) {
		console.error(err);
		toast.add({
			content: t("room-settings.load-failed"),
			duration: 5000,
			style: ToastStyle.Error,
		});
	}
	isLoadingRoomSettings.value = false;
}

function getRoomSettingsSubmit(): Partial<RoomSettings> {
	const propsToGrants = {
		title: "set-title",
		description: "set-description",
		visibility: "set-visibility",
		queueMode: "set-queue-mode",
		autoSkipSegmentCategories: "other",
		restoreQueueBehavior: "other",
		enableVoteSkip: "other",
	};
	const blocked: (keyof RoomSettings)[] = [];
	for (const prop of Object.keys(propsToGrants)) {
		if (
			!dirtySettings.value.includes(prop as keyof typeof propsToGrants) ||
			!granted(`configure-room.${propsToGrants[prop]}`)
		) {
			blocked.push(prop as keyof typeof propsToGrants);
		}
	}
	return _.omit(inputRoomSettings, blocked);
}

/** Take room settings from the UI and submit them to the server. */
async function submitRoomSettings() {
	isLoadingRoomSettings.value = true;
	try {
		await API.patch(
			`/room/${route.params.roomId ?? store.state.room.name}`,
			getRoomSettingsSubmit(),
		);
		toast.add({
			style: ToastStyle.Success,
			content: t("room-settings.settings-applied").toString(),
			duration: 4000,
		});
		dirtySettings.value = [];
	} catch (e) {
		console.log(e);
		toast.add({
			style: ToastStyle.Error,
			content: e.response.data.error.message,
			duration: 6000,
		});
	}
	isLoadingRoomSettings.value = false;
}

async function claimOwnership() {
	isLoadingRoomSettings.value = true;
	try {
		await API.patch(`/room/${route.params.roomId ?? store.state.room.name}`, {
			claim: true,
		});
		toast.add({
			style: ToastStyle.Success,
			content: t("room-settings.now-own-the-room", {
				room: route.params.roomId ?? store.state.room.name,
			}).toString(),
			duration: 4000,
		});
	} catch (e) {
		console.log(e);
		toast.add({
			style: ToastStyle.Error,
			content: e.response.data.error.message,
			duration: 6000,
		});
	}
	isLoadingRoomSettings.value = false;
}
defineExpose({
	loadRoomSettings,
	openVisibilityMenu,
});
</script>

<style scoped>
.room-settings {
	margin: 12px;
}
.room-settings .submit {
	position: -webkit-sticky;
	position: sticky;
	bottom: 20px;
}
</style>
