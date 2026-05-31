<template>
	<Transition appear name="banner">
		<div
			class="vote-skip"
			v-if="store.state.room.enableVoteSkip && currentVotes > 0"
		>
			<div class="vote-skip-row">
				<Icon :icon="mdiSkipNext" class="size-4 text-signal" />
				<span class="vote-skip-text">
					{{ $t("vote-skip.remaining", { count: votesRemaining }) }}
				</span>
			</div>
			<Progress :model-value="progress" class="vote-skip-progress" />
		</div>
	</Transition>
</template>

<script lang="ts" setup>
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { mdiSkipNext } from "@mdi/js";
import { computed } from "vue";
import { useStore } from "@/store";
import { voteSkipThreshold, countEligibleVoters } from "ott-common/voteskip";

const store = useStore();

const threshold = computed(() => {
	const users = Array.from(store.state.users.users.values());
	const eligibleVoters = countEligibleVoters(users, store.state.room.grants);
	return voteSkipThreshold(eligibleVoters);
});

const votesRemaining = computed(() => {
	return threshold.value - store.state.room.votesToSkip.size;
});

const currentVotes = computed(() => {
	return store.state.room.votesToSkip.size;
});

const progress = computed(() => {
	if (threshold.value <= 0) {
		return 0;
	}
	return Math.min(100, (currentVotes.value / threshold.value) * 100);
});
</script>

<style lang="scss" scoped>
@use "./banner-transitions.scss";

.vote-skip {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 8px 14px;
	background: color-mix(in srgb, var(--surface-2) 80%, transparent);
	border: 1px solid var(--line-strong);
	border-left: 3px solid var(--signal);
	border-radius: 2px;
}

.vote-skip-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.vote-skip-text {
	font-family: var(--font-mono);
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--foreground);
}

.vote-skip-progress {
	height: 3px;
}
</style>
