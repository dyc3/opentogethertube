<template>
	<v-select
		v-model="model"
		:items="ALL_SKIP_CATEGORIES"
		:loading="loading"
		:disabled="disabled"
		:label="$t('room-settings.auto-skip-text')"
		chips
		multiple
		data-cy="input-auto-skip"
	/>
</template>

<script setup lang="ts">
import { ALL_SKIP_CATEGORIES } from "ott-common";
import type { Category } from "sponsorblock-api";

const model = defineModel<Category[]>();
defineProps<{
	loading?: boolean;
	disabled?: boolean;
}>();
</script>
