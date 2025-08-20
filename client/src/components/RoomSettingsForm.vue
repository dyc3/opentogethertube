<template>
	<div class="room-settings" style="margin: 12px">
		<v-form @submit="submitRoomSettings">
			<v-text-field
				:label="$t('room-settings.title')"
				v-model="settings.title.value"
				:loading="isLoadingRoomSettings || dirtySettings.includes('title')"
				:disabled="!granted('configure-room.set-title')"
				data-cy="input-title"
			/>
			<v-text-field
				:label="$t('room-settings.description')"
				v-model="settings.description.value"
				:loading="isLoadingRoomSettings || dirtySettings.includes('description')"
				:disabled="!granted('configure-room.set-description')"
				data-cy="input-description"
			/>
			<v-select
				:label="$t('room-settings.visibility')"
				:items="[
					{ title: $t('room-settings.public'), value: Visibility.Public },
					{ title: $t('room-settings.unlisted'), value: Visibility.Unlisted },
				]"
				v-model="settings.visibility.value"
				:loading="isLoadingRoomSettings || dirtySettings.includes('visibility')"
				:disabled="!granted('configure-room.set-visibility')"
				data-cy="select-visibility"
			>
				<template #item="{ props }">
					<v-list-item v-bind="props" />
				</template>
			</v-select>
			<v-select
				:label="$t('room-settings.queue-mode')"
				:items="[
					{
						title: $t('room-settings.manual'),
						value: QueueMode.Manual,
						description: $t('room-settings.manual-hint'),
					},
					{
						title: $t('room-settings.vote'),
						value: QueueMode.Vote,
						description: $t('room-settings.vote-hint'),
					},
					{
						title: $t('room-settings.loop'),
						value: QueueMode.Loop,
						description: $t('room-settings.loop-hint'),
					},
					{
						title: $t('room-settings.dj'),
						value: QueueMode.Dj,
						description: $t('room-settings.dj-hint'),
					},
				]"
				v-model="settings.queueMode.value"
				:loading="isLoadingRoomSettings || dirtySettings.includes('queueMode')"
				:disabled="!granted('configure-room.set-queue-mode')"
				data-cy="select-queueMode"
			>
				<template #item="{ props, item }">
					<v-list-item v-bind="props">
						<span class="text-grey text-caption">{{ item.raw.description }}</span>
					</v-list-item>
				</template>
			</v-select>
			<AutoSkipSegmentSettings
				:loading="
					isLoadingRoomSettings || dirtySettings.includes('autoSkipSegmentCategories')
				"
				:disabled="!granted('configure-room.other')"
				v-model="settings.autoSkipSegmentCategories.value"
			/>
			<v-select
				:label="$t('room-settings.restore-queue')"
				:items="[
					{
						title: $t(`behavior.${BehaviorOption.Always}`),
						value: BehaviorOption.Always,
					},
					{
						title: $t(`behavior.${BehaviorOption.Prompt}`),
						value: BehaviorOption.Prompt,
					},
					{
						title: $t(`behavior.${BehaviorOption.Never}`),
						value: BehaviorOption.Never,
					},
				]"
				v-model="settings.restoreQueueBehavior.value"
				:loading="isLoadingRoomSettings || dirtySettings.includes('restoreQueueBehavior')"
				:disabled="!granted('configure-room.other')"
				data-cy="select-restore-queue"
			>
				<template #item="{ props }">
					<v-list-item v-bind="props" />
				</template>
			</v-select>
			<v-checkbox
				v-model="settings.enableVoteSkip.value"
				:label="$t('room-settings.enable-vote-skip')"
				:disabled="!granted('configure-room.other')"
				data-cy="input-vote-skip"
			/>
			<PermissionsEditor
				v-if="store.state.user && store.state.room.hasOwner"
				v-model="settings.grants.value as Grants"
				:current-role="store.getters['users/self']?.role ?? Role.Owner"
			/>
			<div v-else-if="!store.state.room.hasOwner">
				{{ $t("room-settings.room-needs-owner") }}
				<span v-if="!store.state.user">
					{{ $t("room-settings.login-to-claim") }}
				</span>
			</div>
			<div v-else>
				{{ $t("room-settings.arent-able-to-modify-permissions") }}
			</div>
			<div class="submit">
				<v-btn
					size="large"
					block
					color="#2196f3"
					v-if="!store.state.room.hasOwner"
					:disabled="!store.state.user"
					role="submit"
					@click="claimOwnership"
					data-cy="claim"
				>
					Claim Room
				</v-btn>
				<v-btn
					size="x-large"
					block
					@click="submitRoomSettings"
					role="submit"
					:loading="isLoadingRoomSettings"
					:disabled="dirtySettings.length === 0"
					data-cy="save"
				>
					{{ $t("common.save") }}
				</v-btn>
			</div>
		</v-form>
	</div>
</template>

<script lang="ts" setup>
import { watchDebounced } from "@vueuse/core";
import _ from "lodash";
import { OttApiResponseGetRoom } from "ott-common/models/rest-api";
import { BehaviorOption, QueueMode, Role, RoomSettings, Visibility } from "ott-common/models/types";
import { Grants } from "ott-common/permissions";
import { onMounted, Ref, reactive, ref, toRefs, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { API } from "@/common-http";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { ToastStyle } from "@/models/toast";
import { useStore } from "@/store";
import toast from "@/util/toast";
import AutoSkipSegmentSettings from "./AutoSkipSegmentSettings.vue";
import { useGrants } from "./composables/grants";

const store = useStore();
const { t } = useI18n();
const granted = useGrants();
const route = useRoute();

const isLoadingRoomSettings = ref(false);
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
	{ debounce: 1000 }
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
			`/room/${route.params.roomId ?? store.state.room.name}`
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
			getRoomSettingsSubmit()
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
});
</script>

<style lang="scss">
.room-settings .submit {
	position: -webkit-sticky;
	position: sticky;
	bottom: 20px;

	.v-btn {
		margin: 10px 0;
	}
}
</style>
