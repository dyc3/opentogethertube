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
// import { voteSkipThreshold, countEligibleVoters } from "ott-common/voteskip";
import type { RoomUserInfo } from "ott-common/models/types";
import { Grants } from "ott-common/permissions";

const store = useStore();

// FIXME: fix the import
function voteSkipThreshold(users: number): number {
	return Math.ceil(users * 0.5);
}
function countEligibleVoters(users: RoomUserInfo[], grants: Grants): number {
	let count = 0;
	for (const user of users) {
		if (grants.granted(user.role, "playback.skip")) {
			count++;
		}
	}
	return count;
}

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
