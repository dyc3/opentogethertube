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
					append-icon="fa:fas fa-clipboard"
					:messages="copySuccess ? $t('share-invite.copied') : ''"
					@focus="onFocusHighlightText"
					@click:append="copyInviteLink"
					data-cy="share-invite-link"
				/>
			</v-card-text>
		</v-card>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { useStore } from "@/store";
import { useCopyFromTextbox } from "./composables";

export function buildInviteLink(
	currentLocation: string,
	roomName: string,
	shortUrl: string | undefined
): string {
	if (shortUrl !== undefined) {
		return `https://${shortUrl}/${roomName}`;
	}
	return currentLocation.split("?")[0].toLowerCase();
}

const ShareInvite = defineComponent({
	name: "ShareInvite",
	setup() {
		const store = useStore();

		const inviteLinkText = ref();

		function getInviteLink() {
			return buildInviteLink(
				window.location.href,
				store.state.room.name,
				store.state.shortUrl
			);
		}
		const inviteLink = computed(getInviteLink);

		function onFocusHighlightText(e) {
			e.target.select();
		}

		const { copy: copyInviteLink, copySuccess } = useCopyFromTextbox(
			inviteLink,
			inviteLinkText
		);

		return {
			copySuccess,
			inviteLinkText,
			getInviteLink,
			inviteLink,

			copyInviteLink,
			onFocusHighlightText,
		};
	},
});

export default ShareInvite;
</script>

<style lang="scss"></style>
