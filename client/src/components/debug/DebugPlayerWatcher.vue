<template>
	<div class="debug-player" v-if="!$store.state.production">
		<span>Debug</span>
		<span v-for="(value, key, index) in data" :key="JSON.stringify(value) + index">
			{{ key }}={{ JSON.stringify(value) }}
		</span>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

/** A component to help watch values from video players. */
const DebugPlayerWatcher = defineComponent({
	name: "DebugPlayerWatcher",
	props: {
		data: { type: Object },
	},
});

export default DebugPlayerWatcher;
</script>

<style lang="scss" scoped>
.debug-player {
	display: block;
	width: 100%;
	padding: 0 4px;
	position: absolute;
	top: 0;
	left: 0;
	background: #04f;
	font-size: 12px;
}
</style>
