<template>
	<div class="room-settings" style="margin: 12px">
		<v-form @submit="submitRoomSettings">
			<v-text-field
				label="Title"
				v-model="inputRoomSettings.title"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-title')"
			/>
			<v-text-field
				label="Description"
				v-model="inputRoomSettings.description"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-description')"
			/>
			<v-select
				label="Visibility"
				:items="[{ text: 'public' }, { text: 'unlisted' }]"
				v-model="inputRoomSettings.visibility"
				:loading="isLoadingRoomSettings"
				:disabled="!granted('configure-room.set-visibility')"
				data-cy="select-visibility"
			/>
			<v-select
				label="Queue Mode"
				:items="[
					{ name: 'manual', value: QueueMode.Manual, description: 'Default normal behavior, works how you would expect it to. You can manually reorder items in the queue.' },
					{ name: 'vote', value: QueueMode.Vote, description: 'The highest voted video gets played next.' },
					{ name: 'loop', value: QueueMode.Loop, description: 'When the video ends, put it at the end of the queue.' },
					{ name: 'dj', value: QueueMode.Dj, description: 'When the video ends, start the same video from the beginning. Good for looping background music.' },
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
			<PermissionsEditor
				v-if="!$store.state.room.isTemporary && $store.state.user && $store.state.room.hasOwner"
				v-model="inputRoomSettings.grants"
				:current-role="$store.state.users.you.role"
			/>
			<div v-else-if="$store.state.room.isTemporary">
				Permissions are not available in temporary rooms.
			</div>
			<div v-else-if="!$store.state.room.hasOwner">
				This room needs an owner before permissions can be modified.
				<span v-if="!$store.state.user">
					Log in to claim this room.
				</span>
			</div>
			<div v-else>
				You aren't able to modify permissions in this room.
			</div>
			<div class="submit">
				<v-btn large block color="blue" v-if="!$store.state.room.isTemporary && !$store.state.room.hasOwner" :disabled="!$store.state.user" role="submit" @click="claimOwnership">Claim Room</v-btn>
				<v-btn x-large block @click="submitRoomSettings" role="submit" :loading="isLoadingRoomSettings">Save</v-btn>
			</div>
		</v-form>
	</div>
</template>

<script lang="ts">
import Vue from 'vue';
import _ from "lodash";
import Component from "vue-class-component";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import { ToastStyle } from "@/models/toast";
import { API } from "@/common-http.js";
import { Visibility, QueueMode, RoomSettings } from 'common/models/types';
import PermissionsMixin from "@/mixins/permissions.js";

@Component({
	name: 'RoomSettings',
	components: {
		PermissionsEditor,
	},
	mixins: [PermissionsMixin],
})
export default class RoomSettingsForm extends Vue {
	Visibility = Visibility;
	QueueMode = QueueMode;

	isLoadingRoomSettings = false
	inputRoomSettings = {
		title: '',
		description: '',
		visibility: Visibility.Public,
		queueMode: QueueMode.Manual,
		grants: {},
	}

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
		this.inputRoomSettings = _.pick(res.data, "title", "description", "visibility", "queueMode", "grants");
	}

	getRoomSettingsSubmit() {
		const propsToGrants = {
			title: "set-title",
			description: "set-description",
			visibility: "set-visibility",
			queueMode: "set-queue-mode",
		};
		let blocked: (keyof RoomSettings)[] = [];
		for (let prop of Object.keys(propsToGrants)) {
			// @ts-expect-error I need to convert the permissions mixin to typescript, and have this class extend it in order for typescript shut up.
			if (!this.granted(`configure-room.${propsToGrants[prop]}`)) {
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
				content: `Settings applied`,
				duration: 4000,
			});
		}
		catch (e) {
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
				content: `You now own the room ${this.$route.params.roomId}.`,
				duration: 4000,
			});
		}
		catch (e) {
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
