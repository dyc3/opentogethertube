<template>
	<v-list-item @click="$emit('createtemp')">
		<template #prepend>
			<v-icon>mdi-plus-box</v-icon>
		</template>
		<v-list-item-title>{{ $t("nav.create.temp") }}</v-list-item-title>
		<v-list-item-subtitle class="text-muted">{{
			$t("nav.create.temp-desc")
		}}</v-list-item-subtitle>
	</v-list-item>
	<v-list-item @click="$emit('createperm')">
		<template #prepend>
			<v-icon>mdi-plus-box</v-icon>
		</template>
		<v-list-item-title>{{ $t("nav.create.perm") }}</v-list-item-title>
		<v-list-item-subtitle class="text-muted">{{
			$t("nav.create.perm-desc")
		}}</v-list-item-subtitle>
	</v-list-item>
</template>

<script lang="ts" setup>
defineEmits(["createtemp", "createperm"]);
</script>
