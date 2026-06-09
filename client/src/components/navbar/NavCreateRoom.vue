<template>
	<component
		:is="asMenuItems ? DropdownMenuItem : 'button'"
		:type="asMenuItems ? undefined : 'button'"
		class="ott-create-row"
		@click="$emit('createtemp')"
	>
		<Icon :icon="mdiFlashOutline" class="mt-0.5 size-5 shrink-0 text-primary" />
		<span class="flex flex-col gap-0.5 text-left">
			<span class="font-mono text-sm font-bold tracking-wide uppercase">
				{{ $t("nav.create.temp") }}
			</span>
			<span class="text-xs text-muted-foreground normal-case">
				{{ $t("nav.create.temp-desc") }}
			</span>
		</span>
	</component>
	<component
		:is="asMenuItems ? DropdownMenuItem : 'button'"
		:type="asMenuItems ? undefined : 'button'"
		class="ott-create-row"
		@click="$emit('createperm')"
	>
		<Icon :icon="mdiPlusBox" class="mt-0.5 size-5 shrink-0 text-signal" />
		<span class="flex flex-col gap-0.5 text-left">
			<span class="font-mono text-sm font-bold tracking-wide uppercase">
				{{ $t("nav.create.perm") }}
			</span>
			<span class="text-xs text-muted-foreground normal-case">
				{{ $t("nav.create.perm-desc") }}
			</span>
		</span>
	</component>
</template>

<script lang="ts" setup>
import { Icon } from "@/components/ui/icon";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { mdiPlusBox, mdiFlashOutline } from "@mdi/js";

defineProps<{
	asMenuItems?: boolean;
}>();
defineEmits(["createtemp", "createperm"]);
</script>

<style scoped>
.ott-create-row {
	display: flex;
	width: 100%;
	align-items: flex-start;
	gap: 0.75rem;
	border-radius: var(--radius);
	padding: 0.65rem 0.7rem;
	transition: background 0.15s ease;
}
.ott-create-row:hover {
	background: var(--surface-2);
}
</style>
