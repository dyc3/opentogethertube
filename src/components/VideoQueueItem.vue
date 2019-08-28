<template>
	<v-card :key="item" style="margin-top: 10px">
		<v-card-title>{{ item.id }}</v-card-title>
		<v-card-text>{{ item.service }} {{ item.length }}</v-card-text>
		<v-card-text>{{ item }}</v-card-text>
	</v-card>
</template>

<script>
export default {
	name: "VideoQueueItem",
	props: {
		item: Object
	},
}
</script>