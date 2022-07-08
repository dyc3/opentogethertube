<template>
	<fragment>
		<v-list-item @click="$emit('createtemp')">
			<v-list-item-icon>
				<v-icon>fas fa-plus-square</v-icon>
			</v-list-item-icon>
			<v-list-item-content>
				<v-list-item-title>{{ $t("nav.create.temp") }}</v-list-item-title>
				<v-list-item-subtitle class="text-muted">{{
					$t("nav.create.temp-desc")
				}}</v-list-item-subtitle>
			</v-list-item-content>
		</v-list-item>
		<v-list-item @click="$emit('createperm')">
			<v-list-item-icon>
				<v-icon>fas fa-plus-square</v-icon>
			</v-list-item-icon>
			<v-list-item-content>
				<v-list-item-title>{{ $t("nav.create.perm") }}</v-list-item-title>
				<v-list-item-subtitle class="text-muted">{{
					$t("nav.create.perm-desc")
				}}</v-list-item-subtitle>
			</v-list-item-content>
		</v-list-item>
	</fragment>
</template>
