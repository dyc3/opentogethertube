<template>
	<div class="share-invite">
		<v-card>
			<v-subheader>
				{{ $t("share-invite.title") }}
			</v-subheader>
			<v-card-text>
				{{ $t("share-invite.text") }}
				<v-text-field
					readonly
					outlined
					ref="inviteLinkText"
					:value="getInviteLink()"
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
import { defineComponent, ref } from "@vue/composition-api";
import { useStore } from "@/util/vuex-workaround";

const ShareInvite = defineComponent({
	name: "ShareInvite",
	setup() {
		const store = useStore();

		let copySuccess = ref(false);

		let inviteLinkText = ref();

		function getInviteLink() {
			if (process.env.SHORT_URL) {
				return `https://${process.env.SHORT_URL}/${store.state.room.name}`;
			}
			return window.location.href.split("?")[0].toLowerCase();
		}

		async function copyInviteLink() {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(getInviteLink());
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

			copyInviteLink,
			onFocusHighlightText,
		};
	},
});

export default ShareInvite;
</script>

<style lang="scss"></style>
