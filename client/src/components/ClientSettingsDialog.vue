<template>
	<Dialog v-model:open="show">
		<DialogTrigger as-child>
			<Button variant="ghost" class="mx-5">
				{{ $t("client-settings.activator") }}
			</Button>
		</DialogTrigger>
		<DialogContent class="max-w-xl sm:max-w-xl">
			<DialogHeader>
				<DialogTitle class="font-display text-2xl tracking-wide">
					{{ $t("client-settings.title") }}
				</DialogTitle>
				<DialogDescription>
					{{ $t("client-settings.description") }}
				</DialogDescription>
			</DialogHeader>

			<Separator />

			<div class="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1 py-2">
				<Field>
					<FieldLabel>{{ $t("client-settings.room-layout") }}</FieldLabel>
					<Select v-model="settings.roomLayout">
						<SelectTrigger class="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem v-for="layout in layouts" :key="layout" :value="layout">
								{{ layout }}
							</SelectItem>
						</SelectContent>
					</Select>
				</Field>

				<Field>
					<FieldLabel>{{ $t("client-settings.theme") }}</FieldLabel>
					<Select v-model="settings.theme">
						<SelectTrigger class="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem v-for="theme in themes" :key="theme" :value="theme">
								{{ theme }}
							</SelectItem>
						</SelectContent>
					</Select>
				</Field>

				<div class="flex items-center gap-2">
					<Checkbox id="cs-sfx-enable" v-model="settings.sfxEnabled" />
					<Label for="cs-sfx-enable" class="cursor-pointer">
						{{ $t("client-settings.sfx-enable") }}
					</Label>
				</div>

				<Field>
					<div class="flex items-center justify-between">
						<FieldLabel>{{ $t("client-settings.audio-boost") }}</FieldLabel>
						<span class="audio-boost-value font-mono text-sm">{{ settings.audioBoost }}%</span>
					</div>
					<Slider
						:model-value="[settings.audioBoost]"
						:min="100"
						:max="300"
						:step="1"
						:disabled="isAudioBoostUnsupported"
						@update:model-value="v => v && (settings.audioBoost = v[0])"
					/>
					<FieldDescription>{{ audioBoostHint }}</FieldDescription>
				</Field>

				<Field v-if="settings.sfxEnabled">
					<FieldLabel>{{ $t("client-settings.sfx-volume") }}</FieldLabel>
					<Slider
						:model-value="[settings.sfxVolume]"
						:min="0"
						:max="1"
						:step="0.01"
						@update:model-value="v => v && (settings.sfxVolume = v[0])"
					/>
				</Field>

				<button
					type="button"
					class="flex w-full items-center justify-between rounded-md border border-line bg-surface-2/40 px-3 py-2 font-mono text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
					:aria-expanded="showRoomSettings"
					@click="showRoomSettings = !showRoomSettings"
				>
					<span>{{ $t("client-settings.room-settings") }}</span>
					<Icon
						:icon="mdiChevronDown"
						class="size-4 transition-transform duration-200"
						:class="{ 'rotate-180': showRoomSettings }"
					/>
				</button>

				<Transition name="ott-expand">
					<div v-if="showRoomSettings" class="overflow-hidden">
						<AutoSkipSegmentSettings v-model="autoSkipCategories" />
					</div>
				</Transition>

				<div class="flex items-center gap-2">
					<Checkbox id="cs-adapter-selector" v-model="settings.enableAdapterSelector" />
					<Label for="cs-adapter-selector" class="cursor-pointer">
						{{ $t("client-settings.enable-adapter-selector") }}
					</Label>
				</div>
			</div>

			<Separator />

			<DialogFooter>
				<Button variant="ghost" type="button" @click="cancelSettings">
					{{ $t("common.cancel") }}
				</Button>
				<Button type="button" @click="applySettings">
					{{ $t("common.save") }}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { mdiChevronDown } from "@mdi/js";
import _ from "lodash";
import { ALL_SKIP_CATEGORIES } from "ott-common";
import { computed, type Ref, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { MediaPlayer, MediaPlayerWithAudioBoost } from "@/components/composables";
import { useMediaPlayer } from "@/components/composables";
import { useSfx } from "@/plugins/sfx";
import { useStore } from "@/store";
import { RoomLayoutMode, type SettingsState, Theme } from "@/stores/settings";
import { enumKeys } from "@/util/misc";
import AutoSkipSegmentSettings from "./AutoSkipSegmentSettings.vue";

type ExcludedFields = "volume" | "locale";
type ExposedSettings = Omit<SettingsState, ExcludedFields>;
const EXCLUDED: ExcludedFields[] = ["volume", "locale"];

const show = ref(false);
const store = useStore();
const controls = useMediaPlayer();
const { t } = useI18n();
const settings: Ref<ExposedSettings> = ref(loadSettings());
const sfx = useSfx();

const showRoomSettings = ref(false);
const autoSkipCategories = ref(
	settings.value.defaultRoomSettings?.autoSkipSegmentCategories ?? ALL_SKIP_CATEGORIES,
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

function implementsAudioBoost(player: MediaPlayer | null): player is MediaPlayerWithAudioBoost {
	return !!player && "setAudioBoost" in player;
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
const isAudioBoostUnsupported = computed(() => {
	if (!controls.checkForPlayer(controls.player.value)) {
		return false;
	}

	return !implementsAudioBoost(controls.player.value);
});
const audioBoostHint = computed(() => {
	if (isAudioBoostUnsupported.value) {
		return t("client-settings.audio-boost-unsupported");
	}

	return t("client-settings.audio-boost-hint");
});
</script>

<style scoped>
.audio-boost-value {
	min-width: 3.5rem;
	text-align: right;
}
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
