<template>
	<div class="share-invite">
		<v-card>
			<v-card-title>
				{{ $t("share-invite.title") }}
			</v-card-title>
			<v-card-text>
				{{ $t("share-invite.text") }}
				<v-text-field
					readonly
					variant="outlined"
					:class="copySuccess ? 'text-success' : ''"
					ref="inviteLinkText"
					:value="inviteLink"
					append-icon="mdi-clipboard-outline"
					:messages="copySuccess ? $t('share-invite.copied') : ''"
					@focus="onFocusHighlightText"
					@click:append="copyInviteLink"
					data-cy="share-invite-link"
				/>
			</v-card-text>
		</v-card>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useStore } from "@/store";
import { useCopyFromTextbox } from "./composables";

function buildInviteLink(
	currentLocation: string,
	roomName: string,
	shortUrl: string | undefined
): string {
	if (shortUrl !== undefined) {
		return `https://${shortUrl}/${roomName}`;
	}
	return currentLocation.split("?")[0].toLowerCase();
}

const store = useStore();

const inviteLinkText = ref();

function getInviteLink() {
	return buildInviteLink(window.location.href, store.state.room.name, store.state.shortUrl);
}
const inviteLink = computed(getInviteLink);

function onFocusHighlightText(e) {
	e.target.select();
}

const { copy: copyInviteLink, copySuccess } = useCopyFromTextbox(inviteLink, inviteLinkText);
</script>

<style lang="scss"></style>
