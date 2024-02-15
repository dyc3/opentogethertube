<template>
	<Transition appear name="banner">
		<v-banner
			lines="one"
			density="compact"
			class="vote-skip"
			v-if="store.state.room.enableVoteSkip && currentVotes > 0"
		>
			<v-banner-text>
				{{ $t("vote-skip.remaining", { count: votesRemaining }) }}
			</v-banner-text>
		</v-banner>
	</Transition>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useStore } from "@/store";
import { voteSkipThreshold, countEligibleVoters } from "ott-common/voteskip";

const store = useStore();

const votesRemaining = computed(() => {
	const users = Array.from(store.state.users.users.values());
	const eligibleVoters = countEligibleVoters(users, store.state.room.grants);
	return voteSkipThreshold(eligibleVoters) - store.state.room.votesToSkip.size;
});

const currentVotes = computed(() => {
	return store.state.room.votesToSkip.size;
});
</script>

<style lang="scss">
@import "./banner-transitions.scss";
</style>
