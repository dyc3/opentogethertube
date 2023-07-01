<template>
	<Transition appear name="banner">
		<v-banner
			lines="one"
			density="compact"
			class="vote-skip"
			v-if="store.state.room.enableVoteSkip && currentVotes > 0"
		>
			<v-banner-text>
				{{ votesRemaining }}
				more votes to skip
			</v-banner-text>
		</v-banner>
	</Transition>
</template>

<script lang="ts" setup>
import { computed } from "vue";
// import { voteSkipThreshold } from "ott-common";
import { useStore } from "@/store";

const store = useStore();

// FIXME: fix the import
function voteSkipThreshold(users: number): number {
	return Math.ceil(users * 0.5);
}

const votesRemaining = computed(() => {
	return voteSkipThreshold(store.state.users.users.size) - store.state.room.votesToSkip.size;
});

const currentVotes = computed(() => {
	return store.state.room.votesToSkip.size;
});
</script>

<style lang="scss">
@import "./banner-transitions.scss";
</style>
