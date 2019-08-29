<template>
	<v-card :key="item" style="margin-top: 10px">
		<v-card-title>{{ item.title }}</v-card-title>
		<v-card-text>
			{{ item.service }} {{ item.length }}<br>
			{{ item.description }}
		</v-card-text>
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