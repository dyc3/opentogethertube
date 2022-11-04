<template>
	<div class="room-settings" style="margin: 12px">
		<v-form @submit="submitRoomSettings">
			<v-text-field
				:label="$t('room-settings.title')"
				v-model="inputRoomSettings.title"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-title')"
			/>
			<v-text-field
				:label="$t('room-settings.description')"
				v-model="inputRoomSettings.description"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-description')"
			/>
			<v-select
				:label="$t('room-settings.visibility')"
				:items="[
					{ text: $t('room-settings.public'), value: 'public' },
					{ text: $t('room-settings.unlisted'), value: 'unlisted' },
				]"
				v-model="inputRoomSettings.visibility"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-visibility')"
				data-cy="select-visibility"
			/>
			<v-select
				:label="$t('room-settings.queue-mode')"
				:items="[
					{
						name: $t('room-settings.manual'),
						value: QueueMode.Manual,
						description: $t('room-settings.manual-hint'),
					},
					{
						name: $t('room-settings.vote'),
						value: QueueMode.Vote,
						description: $t('room-settings.vote-hint'),
					},
					{
						name: $t('room-settings.loop'),
						value: QueueMode.Loop,
						description: $t('room-settings.loop-hint'),
					},
					{
						name: $t('room-settings.dj'),
						value: QueueMode.Dj,
						description: $t('room-settings.dj-hint'),
					},
				]"
				v-model="inputRoomSettings.queueMode"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-queue-mode')"
				data-cy="select-queueMode"
			>
				<template v-slot:item="data">
					<v-list-item-content>
						<v-list-item-title>{{ data.item.name }}</v-list-item-title>
						<v-list-item-subtitle>{{ data.item.description }}</v-list-item-subtitle>
					</v-list-item-content>
				</template>
				<template v-slot:selection="data">
					<v-list-item-title>{{ data.item.name }}</v-list-item-title>
				</template>
			</v-select>
			<v-checkbox
				v-model="inputRoomSettings.autoSkipSegments"
				:label="$t('room-settings.auto-skip-text')"
			/>
			<PermissionsEditor
				v-if="
					!$store.state.room.isTemporary &&
					$store.state.user &&
					$store.state.room.hasOwner
				"
				v-model="inputRoomSettings.grants"
				:current-role="$store.state.users.you.role"
			/>
			<div v-else-if="$store.state.room.isTemporary">
				{{ $t("room-settings.permissions-not-available") }}
			</div>
			<div v-else-if="!$store.state.room.hasOwner">
				{{ $t("room-settings.room-needs-owner") }}
				<span v-if="!$store.state.user">
					{{ $t("room-settings.login-to-claim") }}
				</span>
			</div>
			<div v-else>
				{{ $t("room-settings.arent-able-to-modify-permissions") }}
			</div>
			<div class="submit">
				<v-btn
					large
					block
					color="blue"
					v-if="!$store.state.room.isTemporary && !$store.state.room.hasOwner"
					:disabled="!$store.state.user"
					role="submit"
					@click="claimOwnership"
					>Claim Room</v-btn
				>
				<v-btn
					size="x-large"
					block
					@click="submitRoomSettings"
					role="submit"
					:loading="isLoadingRoomSettings"
					>{{ $t("actions.save") }}</v-btn
				>
			</div>
		</v-form>
	</div>
</template>

<script lang="ts">
import _ from "lodash";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { ToastStyle } from "@/models/toast";
import { API } from "@/common-http.js";
import { Visibility, QueueMode, RoomSettings } from "common/models/types";
import type { Grants } from "common/permissions";
import { granted } from "@/util/grants";
import toast from "@/util/toast";
import { defineComponent, onMounted, Ref, ref } from "vue";
import { useStore } from "vuex";
import { i18n } from "@/i18n";

const RoomSettingsForm = defineComponent({
	name: "RoomSettingsForm",
	components: {
		PermissionsEditor,
	},
	setup() {
		const store = useStore();

		let isLoadingRoomSettings = ref(false);
		let inputRoomSettings: Ref<RoomSettings> = ref({
			title: "",
			description: "",
			visibility: Visibility.Public,
			queueMode: QueueMode.Manual,
			grants: {} as Grants,
			autoSkipSegments: true,
		});

		onMounted(async () => {
			await loadRoomSettings();
		});

		async function loadRoomSettings() {
			// we have to make an API request becuase visibility is not sent in sync messages.
			isLoadingRoomSettings.value = true;
			let res = await API.get(`/room/${store.state.room.name}`);
			isLoadingRoomSettings.value = false;
			if (res.data.permissions && !res.data.grants) {
				res.data.grants = res.data.permissions;
			}
			inputRoomSettings.value = _.pick(
				res.data,
				"title",
				"description",
				"visibility",
				"queueMode",
				"grants",
				"autoSkipSegments"
			);
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
			if (store.state.room.isTemporary) {
				blocked.push("grants");
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
					content: i18n.t("room-settings.settings-applied").toString(),
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
					content: i18n
						.t("room-settings.now-own-the-room", {
							room: store.state.room.name,
						})
						.toString(),
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
