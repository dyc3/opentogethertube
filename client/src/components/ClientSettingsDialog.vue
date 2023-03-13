<template>
	<v-dialog v-model="show" width="600">
		<template v-slot:activator="{ props }">
			<v-btn v-bind="props" style="margin: 0 20px">
				{{ $t("client-settings.activator") }}
			</v-btn>
		</template>
		<v-card>
			<v-card-title>
				{{ $t("client-settings.title") }}
			</v-card-title>
			<v-card-text>
				{{ $t("client-settings.description") }}
			</v-card-text>

			<v-divider />

			<v-card-text>
				<v-select
					label="Room Layout"
					:items="[RoomLayoutMode.default, RoomLayoutMode.theater]"
					v-model="settings.roomLayout"
				/>
				<v-select
					label="Theme"
					:items="[Theme.dark, Theme.light, Theme.deepblue, Theme.deepred]"
					v-model="settings.theme"
				>
					<template #item="{ item, props }">
						<v-theme-provider :theme="item.value" with-background>
							<v-list-item v-bind="props" />
						</v-theme-provider>
					</template>
				</v-select>
			</v-card-text>

			<v-divider />

			<v-card-actions>
				<v-spacer />
				<v-btn color="primary" text @click="applySettings">
					{{ $t("common.save") }}
				</v-btn>
				<v-btn text @click="cancelSettings">
					{{ $t("common.cancel") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script lang="ts">
import { defineComponent, Ref, ref, watch } from "vue";
import { useStore } from "@/store";
import { SettingsState, RoomLayoutMode, Theme } from "@/stores/settings";
import _ from "lodash";

type ExcludedFields = "volume" | "locale";
type ExposedSettings = Omit<SettingsState, ExcludedFields>;
const EXCLUDED: ExcludedFields[] = ["volume", "locale"];

export const ClientSettingsDialog = defineComponent({
	name: "ClientSettingsDialog",
	setup() {
		let show = ref(false);
		const store = useStore();
		let settings: Ref<ExposedSettings> = ref(loadSettings());

		function loadSettings(): ExposedSettings {
			let copy = _.cloneDeep(store.state.settings);
			let filtered = _.omit(copy, EXCLUDED);
			return filtered;
		}

		function applySettings() {
			store.commit("settings/UPDATE", settings.value);
			show.value = false;
		}

		function cancelSettings() {
			show.value = false;
		}

		watch(show, () => {
			settings.value = loadSettings();
		});

		return {
			show,
			settings,

			applySettings,
			cancelSettings,
			RoomLayoutMode,
			Theme,
		};
	},
});

export default ClientSettingsDialog;
</script>
