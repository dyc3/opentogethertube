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
					ref="inviteLinkText"
					:value="inviteLink"
					append-outer-icon="fa-clipboard"
					:success-messages="copySuccess ? $t('share-invite.copied') : ''"
					@focus="onFocusHighlightText"
					@click:append-outer="copyInviteLink"
				/>
			</v-card-text>
		</v-card>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { useStore } from "@/store";

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

		let copySuccess = ref(false);

		let inviteLinkText = ref();

		function getInviteLink() {
			return buildInviteLink(
				window.location.href,
				store.state.room.name,
				import.meta.env.SHORT_URL
			);
		}
		const inviteLink = computed(getInviteLink);

		async function copyInviteLink() {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(inviteLink.value);
				setTimeout(() => {
					copySuccess.value = false;
				}, 3000);
			} else {
				// @ts-expect-error $el actually does exist
				let textfield = (inviteLinkText.$el as Element).querySelector("input");
				if (!textfield) {
					console.error("failed to copy link: input not found");
					return;
				}
				textfield.select();
				document.execCommand("copy");
				setTimeout(() => {
					copySuccess.value = false;
					textfield?.blur();
				}, 3000);
			}
			copySuccess.value = true;
		}

		function onFocusHighlightText(e) {
			e.target.select();
		}

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
