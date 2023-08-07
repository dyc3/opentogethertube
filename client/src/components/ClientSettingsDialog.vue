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
					:label="$t('client-settings.room-layout')"
					:items="layouts"
					v-model="settings.roomLayout"
				/>
				<v-select
					:label="$t('client-settings.theme')"
					:items="themes"
					v-model="settings.theme"
				>
					<template #item="{ item, props }">
						<v-theme-provider :theme="item.value" with-background>
							<v-list-item v-bind="props" />
						</v-theme-provider>
					</template>
				</v-select>
				<v-checkbox
					:label="$t('client-settings.sfx-enable')"
					v-model="settings.sfxEnabled"
				/>
				<v-slider
					:label="$t('client-settings.sfx-volume')"
					v-model="settings.sfxVolume"
					v-if="settings.sfxEnabled"
					min="0"
					max="1"
					step="0.01"
				/>
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
import { useSfx } from "@/plugins/sfx";
import { enumKeys } from "@/util/misc";

type ExcludedFields = "volume" | "locale";
type ExposedSettings = Omit<SettingsState, ExcludedFields>;
const EXCLUDED: ExcludedFields[] = ["volume", "locale"];

export const ClientSettingsDialog = defineComponent({
	name: "ClientSettingsDialog",
	setup() {
		const show = ref(false);
		const store = useStore();
		const settings: Ref<ExposedSettings> = ref(loadSettings());
		const sfx = useSfx();

		function loadSettings(): ExposedSettings {
			const copy = _.cloneDeep(store.state.settings);
			const filtered = _.omit(copy, EXCLUDED);
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

		store.subscribe(mutation => {
			if (mutation.type === "settings/UPDATE") {
				sfx.enabled = store.state.settings.sfxEnabled;
				sfx.volume.value = store.state.settings.sfxVolume;
			}
		});

		return {
			show,
			settings,

			applySettings,
			cancelSettings,
			RoomLayoutMode,
			Theme,

			layouts: enumKeys(RoomLayoutMode),
			themes: enumKeys(Theme),
		};
	},
});

export default ClientSettingsDialog;
</script>
