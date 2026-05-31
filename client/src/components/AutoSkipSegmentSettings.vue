<template>
	<div data-cy="input-auto-skip" class="flex flex-col gap-2">
		<FieldLabel class="label-mono text-muted-foreground">
			{{ $t("room-settings.auto-skip-text") }}
		</FieldLabel>
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-2 rounded border border-line bg-surface-3 p-3 sm:grid-cols-3"
			:class="{ 'opacity-50': disabled || loading }"
		>
			<div v-for="cat in ALL_SKIP_CATEGORIES" :key="cat" class="flex items-center gap-2">
				<Checkbox
					:id="`auto-skip-${cat}`"
					:model-value="isSelected(cat)"
					:disabled="disabled || loading"
					@update:model-value="v => toggle(cat, v as boolean)"
				/>
				<Label :for="`auto-skip-${cat}`" class="cursor-pointer text-sm">{{ cat }}</Label>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { ALL_SKIP_CATEGORIES } from "ott-common";
import type { Category } from "sponsorblock-api";

const model = defineModel<Category[]>();
defineProps<{
	loading?: boolean;
	disabled?: boolean;
}>();

function isSelected(cat: Category): boolean {
	return !!model.value?.includes(cat);
}

function toggle(cat: Category, checked: boolean) {
	const current = model.value ? [...model.value] : [];
	if (checked) {
		if (!current.includes(cat)) {
			current.push(cat);
		}
	} else {
		const idx = current.indexOf(cat);
		if (idx >= 0) {
			current.splice(idx, 1);
		}
	}
	model.value = current;
}
</script>
