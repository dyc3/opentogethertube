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

				<v-checkbox
					:label="$t('client-settings.room-settings')"
					v-model="showRoomSettings"
					false-icon="mdi-chevron-up"
					true-icon="mdi-chevron-down"
				/>

				<v-expand-transition>
					<div v-if="showRoomSettings">
						<AutoSkipSegmentSettings v-model="autoSkipCategories" />
					</div>
				</v-expand-transition>
			</v-card-text>

			<v-divider />

			<v-card-actions>
				<v-spacer />
				<v-btn color="primary" @click="applySettings">
					{{ $t("common.save") }}
				</v-btn>
				<v-btn @click="cancelSettings">
					{{ $t("common.cancel") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script lang="ts" setup>
import _ from "lodash";
import { ALL_SKIP_CATEGORIES } from "ott-common";
import { Ref, ref, watch } from "vue";
import { useSfx } from "@/plugins/sfx";
import { useStore } from "@/store";
import { RoomLayoutMode, SettingsState, Theme } from "@/stores/settings";
import { enumKeys } from "@/util/misc";
import AutoSkipSegmentSettings from "./AutoSkipSegmentSettings.vue";

type ExcludedFields = "volume" | "locale";
type ExposedSettings = Omit<SettingsState, ExcludedFields>;
const EXCLUDED: ExcludedFields[] = ["volume", "locale"];

const show = ref(false);
const store = useStore();
const settings: Ref<ExposedSettings> = ref(loadSettings());
const sfx = useSfx();

const showRoomSettings = ref(false);
const autoSkipCategories = ref(
	settings.value.defaultRoomSettings?.autoSkipSegmentCategories ?? ALL_SKIP_CATEGORIES
);

watch(autoSkipCategories, categories => {
	settings.value.defaultRoomSettings = {
		...settings.value.defaultRoomSettings,
		autoSkipSegmentCategories: categories,
	};
});

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

const layouts = enumKeys(RoomLayoutMode);
const themes = enumKeys(Theme);
</script>
