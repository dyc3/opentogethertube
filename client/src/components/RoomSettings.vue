<template>
	<div class="room-settings" style="margin: 12px">
		<v-form @submit="submitRoomSettings">
			<v-text-field
				:label="$t('room-settings.title')"
				v-model="inputRoomSettings.title"
				:loading="isLoadingRoomSettings"
				:disabled="!checker.granted('configure-room.set-title')"
			/>
			<v-text-field
				:label="$t('room-settings.description')"
				v-model="inputRoomSettings.description"
				:loading="isLoadingRoomSettings"
				:disabled="!checker.granted('configure-room.set-description')"
			/>
			<v-select
				:label="$t('room-settings.visibility')"
				:items="[
					{ text: $t('room-settings.public'), value: 'public' },
					{ text: $t('room-settings.unlisted'), value: 'unlisted' },
				]"
				v-model="inputRoomSettings.visibility"
				:loading="isLoadingRoomSettings"
				:disabled="!checker.granted('configure-room.set-visibility')"
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
				:disabled="!checker.granted('configure-room.set-queue-mode')"
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
					x-large
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
import Vue from "vue";
import _ from "lodash";
import Component from "vue-class-component";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { ToastStyle } from "@/models/toast";
import { API } from "@/common-http.js";
import { Visibility, QueueMode, RoomSettings } from "common/models/types";
import type { Grants } from "common/permissions";
import { GrantChecker } from "@/util/grants";

@Component({
	name: "RoomSettings",
	components: {
		PermissionsEditor,
	},
})
export default class RoomSettingsForm extends Vue {
	Visibility = Visibility;
	QueueMode = QueueMode;

	isLoadingRoomSettings = false;
	inputRoomSettings: RoomSettings = {
		title: "",
		description: "",
		visibility: Visibility.Public,
		queueMode: QueueMode.Manual,
		grants: {} as Grants,
		autoSkipSegments: true,
	};

	checker = new GrantChecker();

	mounted() {
		this.loadRoomSettings();
	}

	async loadRoomSettings() {
		// we have to make an API request becuase visibility is not sent in sync messages.
		this.isLoadingRoomSettings = true;
		let res = await API.get(`/room/${this.$route.params.roomId}`);
		this.isLoadingRoomSettings = false;
		if (res.data.permissions && !res.data.grants) {
			res.data.grants = res.data.permissions;
		}
		this.inputRoomSettings = _.pick(
			res.data,
			"title",
			"description",
			"visibility",
			"queueMode",
			"grants",
			"autoSkipSegments"
		);
	}

	getRoomSettingsSubmit() {
		const propsToGrants = {
			title: "set-title",
			description: "set-description",
			visibility: "set-visibility",
			queueMode: "set-queue-mode",
			autoSkipSegments: "set-auto-skip",
		};
		let blocked: (keyof RoomSettings)[] = [];
		for (let prop of Object.keys(propsToGrants)) {
			if (!this.checker.granted(`configure-room.${propsToGrants[prop]}`)) {
				blocked.push(prop as keyof typeof propsToGrants);
			}
		}
		if (this.$store.state.room.isTemporary) {
			blocked.push("grants");
		}
		return _.omit(this.inputRoomSettings, blocked);
	}

	/** Take room settings from the UI and submit them to the server. */
	async submitRoomSettings() {
		this.isLoadingRoomSettings = true;
		try {
			await API.patch(`/room/${this.$route.params.roomId}`, this.getRoomSettingsSubmit());
			this.$toast.add({
				style: ToastStyle.Success,
				content: this.$t("room-settings.settings-applied") as string,
				duration: 4000,
			});
		} catch (e) {
			console.log(e);
			this.$toast.add({
				style: ToastStyle.Error,
				content: e.response.data.error.message,
				duration: 6000,
			});
		}
		this.isLoadingRoomSettings = false;
	}

	async claimOwnership() {
		this.isLoadingRoomSettings = true;
		try {
			await API.patch(`/room/${this.$route.params.roomId}`, {
				claim: true,
			});
			this.$toast.add({
				style: ToastStyle.Success,
				content: this.$t("room-settings.now-own-the-room", {
					room: this.$route.params.roomId,
				}) as string,
				duration: 4000,
			});
		} catch (e) {
			console.log(e);
			this.$toast.add({
				style: ToastStyle.Error,
				content: e.response.data.error.message,
				duration: 6000,
			});
		}
		this.isLoadingRoomSettings = false;
	}
}
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
