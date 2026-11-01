<template>
	<ToggleGroup
		type="single"
		size="sm"
		variant="outline"
		:aria-label="$t('chat.placement.label')"
		:model-value="effectivePlacement"
		@update:model-value="onUpdate"
	>
		<ToggleGroupItem
			value="video"
			class="gap-1.5"
			:disabled="!inVideoAllowed"
			:title="inVideoAllowed ? undefined : $t('chat.placement.youtube-unsupported')"
			data-cy="chat-placement-video"
		>
			<Icon :icon="mdiPictureInPictureBottomRight" class="size-4" />
			{{ $t("chat.placement.in-video") }}
		</ToggleGroupItem>
		<ToggleGroupItem value="panel" class="gap-1.5" data-cy="chat-placement-panel">
			<Icon :icon="mdiDockRight" class="size-4" />
			{{ $t("chat.placement.panel") }}
		</ToggleGroupItem>
	</ToggleGroup>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { mdiDockRight, mdiPictureInPictureBottomRight } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStore } from "@/store";
import { ChatPlacement } from "@/stores/settings";

const props = defineProps<{
	/** False while the current video doesn't allow anything drawn over it (YouTube). */
	inVideoAllowed: boolean;
}>();

const store = useStore();

const effectivePlacement = computed(() =>
	props.inVideoAllowed ? store.state.settings.chatPlacement : ChatPlacement.panel,
);

function onUpdate(value: unknown) {
	if (value === ChatPlacement.video || value === ChatPlacement.panel) {
		store.commit("settings/UPDATE", { chatPlacement: value });
	}
}
</script>
