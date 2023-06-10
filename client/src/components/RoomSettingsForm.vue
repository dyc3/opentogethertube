<template>
	<div class="room-settings" style="margin: 12px">
		<v-form @submit="submitRoomSettings">
			<v-text-field
				:label="$t('room-settings.title')"
				v-model="inputRoomSettings.title"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-title')"
				data-cy="input-title"
			/>
			<v-text-field
				:label="$t('room-settings.description')"
				v-model="inputRoomSettings.description"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-description')"
				data-cy="input-description"
			/>
			<v-select
				:label="$t('room-settings.visibility')"
				:items="[
					{ title: $t('room-settings.public'), value: 'public' },
					{ title: $t('room-settings.unlisted'), value: 'unlisted' },
				]"
				v-model="inputRoomSettings.visibility"
				:loading="isLoadingRoomSettings"
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
				v-model="inputRoomSettings.queueMode"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-queue-mode')"
				data-cy="select-queueMode"
			>
				<template #item="{ props, item }">
					<v-list-item v-bind="props">
						<span class="text-grey text-caption">{{ item.raw.description }}</span>
					</v-list-item>
				</template>
			</v-select>
			<v-checkbox
				v-model="inputRoomSettings.autoSkipSegments"
				:label="$t('room-settings.auto-skip-text')"
				:disabled="!granted('configure-room.set-auto-skip')"
				data-cy="input-auto-skip"
			/>
			<PermissionsEditor
				v-if="store.state.user && store.state.room.hasOwner"
				v-model="inputRoomSettings.grants"
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
					color="blue"
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
					data-cy="save"
				>
					{{ $t("common.save") }}
				</v-btn>
			</div>
		</v-form>
	</div>
</template>

<script lang="ts">
import _ from "lodash";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { ToastStyle } from "@/models/toast";
import { API } from "@/common-http";
import { Visibility, QueueMode, RoomSettings, Role } from "ott-common/models/types";
import { Grants } from "ott-common/permissions";
import { granted } from "@/util/grants";
import toast from "@/util/toast";
import { defineComponent, onMounted, Ref, ref } from "vue";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { OttApiResponseGetRoom } from "ott-common/models/rest-api";

const RoomSettingsForm = defineComponent({
	name: "RoomSettingsForm",
	components: {
		PermissionsEditor,
	},
	setup() {
		const store = useStore();
		const { t } = useI18n();

		let isLoadingRoomSettings = ref(false);
		let inputRoomSettings: Ref<RoomSettings> = ref({
			title: "",
			description: "",
			visibility: Visibility.Public,
			queueMode: QueueMode.Manual,
			grants: new Grants(),
			autoSkipSegments: true,
		});

		onMounted(async () => {
			await loadRoomSettings();
		});

		async function loadRoomSettings() {
			// we have to make an API request becuase visibility is not sent in sync messages.
			isLoadingRoomSettings.value = true;
			try {
				let res = await API.get<OttApiResponseGetRoom>(`/room/${store.state.room.name}`);
				let settings = res.data;
				settings.grants = new Grants(res.data.grants);
				inputRoomSettings.value = _.pick(
					settings,
					"title",
					"description",
					"visibility",
					"queueMode",
					"grants",
					"autoSkipSegments"
				);
			} catch (err) {
				toast.add({
					content: t("room-settings.load-failed"),
					duration: 5000,
					style: ToastStyle.Error,
				});
			}
			isLoadingRoomSettings.value = false;
		}

		function getRoomSettingsSubmit() {
			const propsToGrants = {
				title: "set-title",
				description: "set-description",
				visibility: "set-visibility",
				queueMode: "set-queue-mode",
				autoSkipSegments: "set-auto-skip",
			};
			let blocked: (keyof RoomSettings)[] = [];
			for (let prop of Object.keys(propsToGrants)) {
				if (!granted(`configure-room.${propsToGrants[prop]}`)) {
					blocked.push(prop as keyof typeof propsToGrants);
				}
			}
			return _.omit(inputRoomSettings.value, blocked);
		}

		/** Take room settings from the UI and submit them to the server. */
		async function submitRoomSettings() {
			isLoadingRoomSettings.value = true;
			try {
				await API.patch(`/room/${store.state.room.name}`, getRoomSettingsSubmit());
				toast.add({
					style: ToastStyle.Success,
					content: t("room-settings.settings-applied").toString(),
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

		async function claimOwnership() {
			isLoadingRoomSettings.value = true;
			try {
				await API.patch(`/room/${store.state.room.name}`, {
					claim: true,
				});
				toast.add({
					style: ToastStyle.Success,
					content: t("room-settings.now-own-the-room", {
						room: store.state.room.name,
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

		return {
			isLoadingRoomSettings,
			inputRoomSettings,

			loadRoomSettings,
			getRoomSettingsSubmit,
			submitRoomSettings,
			claimOwnership,

			store,
			granted,
			Visibility,
			QueueMode,
			Role,
		};
	},
});

export default RoomSettingsForm;
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
